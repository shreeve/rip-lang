// ============================================================================
// extension_test.cpp — Phase 2A in-process driver for the ripdb extension.
//
// Creates an in-process DuckDB instance (from the pinned misc/duckdb source),
// registers the ripdb StorageExtension by calling our Load(loader) directly
// (no .duckdb_extension file, no LOAD statement, no metadata footer), then
// runs the end-to-end smoke: ATTACH, SHOW TABLES, DESCRIBE, SELECT joins.
//
// The server fixture is a :memory: rip-db started externally by the caller
// (typically packages/db/extension/scripts/smoke-server.rip), seeded with
// a small schema. This keeps extension_test focused on the extension itself.
// ============================================================================

#include "duckdb.hpp"
#include "duckdb/main/extension/extension_loader.hpp"
#include "duckdb/main/database.hpp"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

// For the M2.4 refresh test we need to mutate the remote schema mid-run;
// easiest way is to POST to rip-db's /sql endpoint directly (same code
// path the smoke-server uses to seed, now reused from C++). Plain BSD
// sockets, enough to fire a one-shot request at localhost.
#include <netdb.h>
#include <sys/socket.h>
#include <unistd.h>

namespace duckdb { namespace ripdb {
void Load(ExtensionLoader &loader);                 // re-declared here; defined in ripdb.cpp
} }

struct TestStats {
	int total   = 0;
	int passed  = 0;
};

// Generic raw-socket HTTP POST. Used by tests that need to bypass the
// extension and hit endpoints directly with arbitrary bodies (e.g. NUL
// bytes, multi-statement chains) where the JSON wrapper of PostSql
// would either escape the attack away or pick the wrong endpoint.
// Returns the raw response (headers + body) or empty string on socket
// failure.
static std::string PostRaw(const std::string &host, int port,
                            const std::string &path,
                            const std::string &content_type,
                            const std::string &body) {
	std::string req = "POST " + path + " HTTP/1.1\r\n"
	                   "Host: " + host + ":" + std::to_string(port) + "\r\n"
	                   "Content-Type: " + content_type + "\r\n"
	                   "Content-Length: " + std::to_string(body.size()) + "\r\n"
	                   "Connection: close\r\n\r\n" + body;
	struct addrinfo hints {};
	hints.ai_family   = AF_UNSPEC;
	hints.ai_socktype = SOCK_STREAM;
	struct addrinfo *res = nullptr;
	if (getaddrinfo(host.c_str(), std::to_string(port).c_str(), &hints, &res) != 0 || !res) {
		if (res) freeaddrinfo(res);
		return {};
	}
	int fd = -1;
	for (auto *ai = res; ai && fd < 0; ai = ai->ai_next) {
		int try_fd = socket(ai->ai_family, ai->ai_socktype, ai->ai_protocol);
		if (try_fd < 0) continue;
		if (connect(try_fd, ai->ai_addr, ai->ai_addrlen) == 0) fd = try_fd;
		else close(try_fd);
	}
	freeaddrinfo(res);
	if (fd < 0) return {};

	const char *p = req.data(); size_t left = req.size();
	while (left > 0) { ssize_t n = send(fd, p, left, 0); if (n <= 0) break; p += n; left -= (size_t)n; }
	std::string raw; char buf[4096];
	while (true) { ssize_t n = recv(fd, buf, sizeof(buf), 0); if (n <= 0) break; raw.append(buf, (size_t)n); }
	close(fd);
	return raw;
}

// JSON-wrapped /sql POST — used to mutate the remote schema during the
// M2.4 rip_refresh test. Returns the raw response body on 2xx, empty
// string on socket failure (best effort; the test asserts on expected
// SQL-side effects afterward).
static std::string PostSql(const std::string &host, int port, const std::string &sql) {
	std::string body = "{\"sql\":\"";
	for (char c : sql) {
		if (c == '"' || c == '\\') body += '\\';
		body += c;
	}
	body += "\"}";
	return PostRaw(host, port, "/sql", "application/json", body);
}

// Parse "rip://host:port" / "http://host:port" / "host:port" into host + port.
static bool ParseHostPort(const std::string &url, std::string &host, int &port) {
	std::string rest = url;
	auto sep = rest.find("://");
	if (sep != std::string::npos) rest = rest.substr(sep + 3);
	auto slash = rest.find('/');
	if (slash != std::string::npos) rest = rest.substr(0, slash);
	auto colon = rest.find(':');
	if (colon == std::string::npos) { host = rest; port = 80; return !host.empty(); }
	host = rest.substr(0, colon);
	port = std::atoi(rest.c_str() + colon + 1);
	return !host.empty() && port > 0;
}

static void expect_ok(duckdb::Connection &con, const std::string &sql, TestStats &s,
                       const char *label) {
	++s.total;
	auto r = con.Query(sql);
	if (r->HasError()) {
		std::printf("FAIL  %s — %s\n       sql: %s\n", label, r->GetError().c_str(), sql.c_str());
		return;
	}
	++s.passed;
	std::printf("PASS  %s\n", label);
}

static void expect_rows(duckdb::Connection &con, const std::string &sql, idx_t expected_rows,
                         TestStats &s, const char *label) {
	++s.total;
	auto r = con.Query(sql);
	if (r->HasError()) {
		std::printf("FAIL  %s — %s\n       sql: %s\n", label, r->GetError().c_str(), sql.c_str());
		return;
	}
	idx_t count = 0;
	while (true) {
		auto chunk = r->Fetch();
		if (!chunk || chunk->size() == 0) break;
		count += chunk->size();
	}
	if (count != expected_rows) {
		std::printf("FAIL  %s — expected %llu rows, got %llu\n       sql: %s\n", label,
		            static_cast<unsigned long long>(expected_rows),
		            static_cast<unsigned long long>(count), sql.c_str());
		return;
	}
	++s.passed;
	std::printf("PASS  %s — %llu rows\n", label, static_cast<unsigned long long>(count));
}

static void expect_contains(duckdb::Connection &con, const std::string &sql,
                              const std::string &needle, TestStats &s, const char *label) {
	++s.total;
	auto r = con.Query(sql);
	if (r->HasError()) {
		std::printf("FAIL  %s — %s\n", label, r->GetError().c_str());
		return;
	}
	auto s1 = r->ToString();
	if (s1.find(needle) == std::string::npos) {
		std::printf("FAIL  %s — output does not contain '%s'\n       got: %s\n",
		            label, needle.c_str(), s1.c_str());
		return;
	}
	++s.passed;
	std::printf("PASS  %s — contains '%s'\n", label, needle.c_str());
}

int main(int argc, char **argv) {
	// See CLI.md §Implementation progress — we use `rip://` here rather than
	// `http://` to sidestep DuckDB's EXTENSION_FILE_PREFIXES autoload, which
	// insists on loading httpfs before our (TYPE ripdb) clause is considered.
	// On a DuckDB build that has httpfs available, either URL works.
	const char *rip_db_url = (argc > 1) ? argv[1] : "rip://localhost:4214";

	// We don't need allow_unsigned_extensions here — Load() is called
	// directly, not via LOAD/dlopen. Signature checks are in that load path.
	duckdb::DuckDB db(nullptr);
	duckdb::Connection con(db);

	// Register the ripdb storage extension directly via our Load() function.
	// This bypasses the on-disk .duckdb_extension loading path — the extension
	// name below is just a label for diagnostics.
	{
		duckdb::ExtensionLoader loader(*db.instance, "ripdb");
		duckdb::ripdb::Load(loader);
	}

	TestStats s;
	std::printf("# ripdb extension in-process smoke (rip-db @ %s)\n", rip_db_url);

	// Defensive baseline: the assertions below assume the remote has
	// exactly the two seed tables `smoke_people` + `smoke_orders`. The
	// M2.4 rip_refresh test creates `smoke_fresh` mid-run and drops it
	// at the end, but if a previous extension_test invocation crashed
	// before the cleanup, `smoke_fresh` would still be on the server.
	// PostSql is best-effort and ignores errors.
	{
		std::string host; int port = 0;
		if (ParseHostPort(rip_db_url, host, port)) {
			PostSql(host, port, "DROP TABLE IF EXISTS smoke_fresh");
		}
	}

	// ATTACH the remote database under alias 'rip'.
	expect_ok(con,
	          std::string("ATTACH '") + rip_db_url + "' AS rip (TYPE ripdb)",
	          s, "ATTACH rip");

	// Catalog-level introspection via DuckDB's own catalog (not
	// information_schema — ripdb exposes a single 'main' schema only).
	expect_rows(con, "SELECT table_name FROM duckdb_tables() "
	                 "WHERE database_name = 'rip' ORDER BY table_name", 2,
	            s, "duckdb_tables reports 2 tables in rip");

	expect_contains(con, "SHOW TABLES FROM rip", "smoke_people",
	                s, "SHOW TABLES FROM rip lists smoke_people");
	expect_contains(con, "SHOW TABLES FROM rip", "smoke_orders",
	                s, "SHOW TABLES FROM rip lists smoke_orders");

	expect_contains(con, "DESCRIBE rip.smoke_people", "full_name",
	                s, "DESCRIBE rip.smoke_people includes full_name");
	expect_contains(con, "DESCRIBE rip.smoke_orders", "amount",
	                s, "DESCRIBE rip.smoke_orders includes amount");

	// Basic scan + count.
	expect_rows(con, "SELECT * FROM rip.smoke_people ORDER BY id", 10,
	            s, "SELECT * FROM rip.smoke_people returns 10 rows");
	expect_rows(con, "SELECT * FROM rip.smoke_orders ORDER BY id", 20,
	            s, "SELECT * FROM rip.smoke_orders returns 20 rows");

	// Projection pushdown: ask for a subset of columns.
	expect_rows(con, "SELECT id, full_name FROM rip.smoke_people", 10,
	            s, "projected SELECT returns 10 rows");

	// Cross-table join between two remote tables. Local DuckDB planner does
	// the join; the extension just hands over rows for each side.
	expect_rows(con,
	            "SELECT p.full_name, o.amount FROM rip.smoke_people p "
	            "JOIN rip.smoke_orders o ON o.person_id = p.id",
	            20, s, "join across rip.smoke_people × rip.smoke_orders");

	// Aggregation locally on remote rows.
	expect_contains(con,
	            "SELECT count(*) AS c, sum(amount) AS s FROM rip.smoke_orders",
	            "20", s, "aggregate count = 20");

	// NULL handling — smoke_people has NULL birthdates for even ids.
	expect_contains(con,
	            "SELECT count(*) FROM rip.smoke_people WHERE birthdate IS NULL",
	            "5", s, "NULL handling — 5 of 10 birthdates are NULL");

	// =========================================================================
	// M3 — native DML (INSERT/UPDATE/DELETE).
	// =========================================================================
	//
	// All scenarios target smoke_orders so we can restore the fixture by
	// deleting our marker rows at the end. Idempotent across runs.

	auto expect_error_contains = [&](const std::string &sql, const std::string &needle,
	                                  const char *label) {
		++s.total;
		auto r = con.Query(sql);
		if (r->HasError() && r->GetError().find(needle) != std::string::npos) {
			++s.passed;
			std::printf("PASS  %s\n", label);
		} else {
			std::printf("FAIL  %s — expected error containing '%s', got: %s\n",
			            label, needle.c_str(),
			            r->HasError() ? r->GetError().c_str() : "<no error>");
		}
	};

	// --- INSERT VALUES (single row) — Path 1 passthrough ---
	expect_ok(con,
	          "INSERT INTO rip.smoke_orders VALUES (1001, 1, 'DML-A', 'USD', 100.0, 100.00)",
	          s, "INSERT one row via passthrough");
	expect_rows(con, "SELECT * FROM rip.smoke_orders ORDER BY id", 21,
	            s, "smoke_orders count is now 21");

	// --- INSERT VALUES (multi-row) — Path 1 passthrough ---
	expect_ok(con,
	          "INSERT INTO rip.smoke_orders VALUES "
	          "(1002, 2, 'DML-B', 'USD', 200.0, 200.00), "
	          "(1003, 3, 'DML-C', 'EUR', 300.0, 300.00)",
	          s, "INSERT multi-row via passthrough");
	expect_rows(con, "SELECT * FROM rip.smoke_orders ORDER BY id", 23,
	            s, "smoke_orders count is now 23");

	// --- UPDATE with WHERE — Path 1 passthrough ---
	expect_ok(con,
	          "UPDATE rip.smoke_orders SET sku = 'DML-A-upd' WHERE id = 1001",
	          s, "UPDATE one row via passthrough");
	expect_contains(con,
	                "SELECT sku FROM rip.smoke_orders WHERE id = 1001",
	                "DML-A-upd", s, "UPDATE took effect");

	// --- DELETE with WHERE — Path 1 passthrough ---
	expect_ok(con,
	          "DELETE FROM rip.smoke_orders WHERE id IN (1001, 1002, 1003)",
	          s, "DELETE three rows via passthrough");
	expect_rows(con, "SELECT * FROM rip.smoke_orders ORDER BY id", 20,
	            s, "smoke_orders restored to 20 rows");

	// --- Catalog-qualified target rewrites correctly ---
	// `rip.main.smoke_orders` -> the catalog-prefix rewrite step strips the
	// `rip.` qualifier; the remote DuckDB sees `main.smoke_orders`.
	expect_ok(con,
	          "INSERT INTO rip.main.smoke_orders VALUES (1010, 1, 'CAT-Q', 'USD', 50.0, 50.00)",
	          s, "INSERT with rip.main.t qualifier (catalog rewrite)");
	expect_ok(con, "DELETE FROM rip.smoke_orders WHERE id = 1010",
	          s, "DELETE the catalog-qualified-test row (cleanup)");

	// --- INSERT INTO ... SELECT FROM (ripdb source) ---
	// All INSERT...SELECT routes through the sink fallback (regardless of
	// whether the source is a ripdb attachment or local data). DuckDB's
	// local binder resolves the source, the sink materializes the rows
	// into typed literals, and only INSERT VALUES reaches the remote.
	// This test verifies the ripdb-source case rounds-trips correctly.
	expect_ok(con,
	          "INSERT INTO rip.smoke_orders SELECT id+1100, person_id, 'pure-rip-' || CAST(id AS VARCHAR), "
	          "currency, amount, price FROM rip.smoke_orders WHERE id <= 3",
	          s, "INSERT ... SELECT FROM rip.t (sink fallback materializes ripdb source)");
	expect_rows(con, "SELECT * FROM rip.smoke_orders WHERE id BETWEEN 1101 AND 1103", 3,
	            s, "ripdb-source INSERT-SELECT inserted 3 rows");
	expect_ok(con, "DELETE FROM rip.smoke_orders WHERE id BETWEEN 1101 AND 1103",
	          s, "cleanup: DELETE INSERT-SELECT-from-ripdb rows");

	// --- INSERT INTO ... SELECT from local table (Path 2 sink fallback) ---
	// Build a local table and INSERT from it. The dependency walk rejects
	// Path 1 (local catalog reference inside the source plan), and we fall
	// through to PhysicalRipInsertSink which materializes child rows and
	// emits one typed-literal INSERT VALUES.
	expect_ok(con,
	          "CREATE TEMP TABLE local_seed AS "
	          "SELECT 1200 AS id, 1 AS person_id, 'sink-A' AS sku, 'USD' AS currency, "
	          "100.0 AS amount, 100.00::DECIMAL(10,2) AS price "
	          "UNION ALL SELECT 1201, 2, 'sink-B', 'EUR', 200.0, 200.00",
	          s, "create local seed table");
	expect_ok(con,
	          "INSERT INTO rip.smoke_orders SELECT * FROM local_seed",
	          s, "INSERT ... SELECT FROM local_t (sink fallback path)");
	expect_rows(con, "SELECT * FROM rip.smoke_orders WHERE id BETWEEN 1200 AND 1201", 2,
	            s, "sink-fallback INSERT inserted 2 rows");
	expect_ok(con, "DELETE FROM rip.smoke_orders WHERE id BETWEEN 1200 AND 1201",
	          s, "cleanup: DELETE sink-fallback rows");
	expect_ok(con, "DROP TABLE local_seed", s, "drop local_seed");

	// --- Reject list ---
	expect_error_contains(
	    "INSERT INTO rip.smoke_orders VALUES (1300, 1, 'X', 'USD', 0.0, 0.00) RETURNING id",
	    "RETURNING is not supported",
	    "INSERT ... RETURNING is rejected with clear message");

	// Use the no-target form: `ON CONFLICT (id) DO NOTHING` would fire the
	// local binder's "column isn't UNIQUE" error first, before we get a
	// chance to reject it. The bare `DO NOTHING` form skips the binder
	// check and reaches our PlanInsert.
	expect_error_contains(
	    "INSERT INTO rip.smoke_orders VALUES (1301, 1, 'X', 'USD', 0.0, 0.00) "
	    "ON CONFLICT DO NOTHING",
	    "ON CONFLICT",
	    "INSERT ... ON CONFLICT is rejected with clear message");

	// --- AST safety walker: rowid in DML rejected.
	// ripdb's scan synthesizes a sequential rowid locally; forwarding
	// `WHERE rowid = N` to the remote would mutate a different physical
	// row. Must reject regardless of WHERE position.
	expect_error_contains(
	    "DELETE FROM rip.smoke_orders WHERE rowid = 0",
	    "rowid",
	    "DELETE ... WHERE rowid = N is rejected (synthetic-rowid safety)");
	expect_error_contains(
	    "UPDATE rip.smoke_orders SET sku = 'rowid-test' WHERE rowid = 0",
	    "rowid",
	    "UPDATE ... WHERE rowid = N is rejected (synthetic-rowid safety)");

	// --- AST safety walker: qualified identifier in expression position.
	// The TableRef rewriter only touches FROM-clause refs. Fully-qualified
	// `rip.smoke_orders.id` in a WHERE / SET / subquery is the silent-
	// corruption risk: if the remote happened to have a schema named `rip`,
	// the statement would mis-target. Must reject.
	expect_error_contains(
	    "DELETE FROM rip.smoke_orders WHERE rip.smoke_orders.id = 1",
	    "qualified identifier",
	    "DELETE with qualified ident in WHERE is rejected (safety walker)");
	expect_error_contains(
	    "UPDATE rip.smoke_orders SET sku = 'X' WHERE rip.smoke_orders.id = 1",
	    "qualified identifier",
	    "UPDATE with qualified ident in WHERE is rejected (safety walker)");

	// --- AST safety walker: scalar subquery into a self-reference.
	// The subquery `SELECT max(amount) FROM rip.smoke_orders` parses with a
	// SubqueryExpression whose inner SELECT has a BaseTableRef the rewriter
	// DOES handle, so this particular form actually rewrites cleanly and is
	// allowed. This test documents that the safety walker accepts it
	// rather than throwing — a regression of either direction is worth
	// catching.
	expect_ok(con,
	          "UPDATE rip.smoke_orders SET amount = (SELECT max(amount) FROM rip.smoke_orders) "
	          "WHERE id = 1",
	          s, "UPDATE ... SET = (SELECT FROM rip.t) is supported");
	// Restore (the previous statement set amount = 250.00, the max).
	expect_ok(con, "UPDATE rip.smoke_orders SET amount = 12.50 WHERE id = 1",
	          s, "restore amount on id=1");

	// --- Semicolon-in-string-literal must work end-to-end.
	// A previous server-side regex rejected any payload containing ';'
	// outside trailing position, including legal string literals.
	// Verify both passthrough INSERT VALUES and sink-fallback paths.
	expect_ok(con,
	          "INSERT INTO rip.smoke_orders VALUES (1500, 1, 'a;b;c', 'USD', 0.0, 0.00)",
	          s, "INSERT VALUES with ';' in string literal works (passthrough)");
	expect_contains(con,
	                "SELECT sku FROM rip.smoke_orders WHERE id = 1500",
	                "a;b;c", s, "string with embedded ';' round-trips");
	expect_ok(con, "DELETE FROM rip.smoke_orders WHERE id = 1500",
	          s, "cleanup: DELETE the semicolon-test row");

	// --- Sink fallback with explicit column list (different from SELECT *)
	expect_ok(con,
	          "CREATE TEMP TABLE sink_seed AS SELECT 1600 AS x, 7 AS y, 'sink-cols' AS z",
	          s, "create sink_seed for column-list test");
	expect_ok(con,
	          "INSERT INTO rip.smoke_orders (id, person_id, sku) "
	          "SELECT x, y, z FROM sink_seed",
	          s, "INSERT (cols) SELECT FROM local_t (sink fallback, explicit column list)");
	expect_contains(con,
	                "SELECT sku FROM rip.smoke_orders WHERE id = 1600",
	                "sink-cols", s, "sink-fallback explicit-column-list INSERT writes to right columns");
	expect_ok(con, "DELETE FROM rip.smoke_orders WHERE id = 1600",
	          s, "cleanup: DELETE the column-list-test row");
	expect_ok(con, "DROP TABLE sink_seed", s, "drop sink_seed");

	// --- INSERT...SELECT with ORDER BY uses the sink fallback (which
	// materializes the source through DuckDB's local binder). Both the
	// qualified and unqualified ORDER BY forms work because the sink path
	// doesn't depend on the AST safety walker — only typed-literal
	// INSERT VALUES reaches the remote, regardless of source-side shape.
	expect_ok(con,
	          "INSERT INTO rip.smoke_orders SELECT id+5500, person_id, 'order-by-q', currency, "
	          "amount, price FROM rip.smoke_orders WHERE id < 3 ORDER BY rip.smoke_orders.id",
	          s, "INSERT...SELECT with qualified ORDER BY succeeds via sink fallback");
	expect_ok(con,
	          "INSERT INTO rip.smoke_orders SELECT id+5510, person_id, 'order-by-uq', "
	          "currency, amount, price FROM rip.smoke_orders WHERE id < 3 ORDER BY id",
	          s, "INSERT...SELECT with unqualified ORDER BY succeeds via sink fallback");
	expect_ok(con, "DELETE FROM rip.smoke_orders WHERE id BETWEEN 5500 AND 5520",
	          s, "cleanup: order-by test rows");

	// --- AST safety walker: prepared parameter inside ORDER BY (modifier walk).
	// We can't easily PREPARE a statement from extension_test's helpers; the
	// closest reachable shape is to verify the validator catches a parameter
	// expression in a normal LIMIT slot. ParameterExpression is rejected
	// uniformly via ValidateParsedExpression regardless of position.
	expect_error_contains(
	    "DELETE FROM rip.smoke_orders WHERE id IN (SELECT id FROM rip.smoke_orders LIMIT $1)",
	    "parameter",
	    "DELETE with prepared placeholder inside a subquery LIMIT is rejected");

	// --- Multi-ripdb cross-attachment mis-target reject.
	// We don't actually start a second rip-db, but we can simulate a
	// dangling cross-schema BaseTableRef by attaching a local DuckDB schema
	// and writing a statement that targets our ripdb table but reads from
	// `other_schema.t`. The rewriter only strips `rip.`, the AST safety
	// walker should refuse the dangling `other_schema.t` qualifier.
	expect_ok(con, "CREATE SCHEMA other_schema", s, "create local schema for cross-attach test");
	expect_ok(con, "CREATE TABLE other_schema.bait AS SELECT 1 AS id, 'bait' AS sku",
	          s, "create bait table in local schema");
	// Either rejection (OnlyRipdbScans for the local LogicalGet, or the
	// pre-rewrite provenance walker) is acceptable; we just need refusal.
	expect_error_contains(
	    "DELETE FROM rip.smoke_orders WHERE id IN (SELECT id FROM other_schema.bait)",
	    "ripdb",
	    "DELETE referencing local cross-schema BaseTableRef is rejected");
	expect_ok(con, "DROP TABLE other_schema.bait", s, "drop bait");
	expect_ok(con, "DROP SCHEMA other_schema", s, "drop other_schema");

	// --- /ddb/exec multi-statement attack via direct HTTP.
	// Bypassing the extension entirely, hit /ddb/exec with two statements
	// chained by ';'. The endpoint must reject via duckdb_extract_statements
	// — we can't allow a back door that runs DDL after a leading-keyword
	// INSERT.
	{
		std::string host; int port = 0;
		++s.total;
		if (!ParseHostPort(rip_db_url, host, port)) {
			std::printf("FAIL  could not parse host/port for /ddb/exec chain test\n");
		} else {
			std::string resp = PostRaw(host, port, "/ddb/exec", "text/plain",
			    "INSERT INTO smoke_orders VALUES (9991, 1, 'ok', 'USD', 0.0, 0.00); DROP TABLE smoke_orders");
			if (resp.find("HTTP/1.1 400") != std::string::npos &&
			    resp.find("exactly one statement") != std::string::npos) {
				++s.passed;
				std::printf("PASS  /ddb/exec rejects multi-statement chain attack\n");
			} else {
				std::printf("FAIL  /ddb/exec accepted INSERT;DROP chain — got: %s\n",
				            resp.empty() ? "<empty>" : resp.c_str());
			}
		}
	}
	// Confirm smoke_orders still exists (the DROP must not have run).
	expect_rows(con, "SELECT * FROM rip.smoke_orders", 20,
	            s, "/ddb/exec chain attack didn't execute the DROP");

	// --- Multi-ripdb USE-attack defense for UPDATE.
	// The dangerous shape is "passthrough source has unqualified
	// BaseTableRef whose binding came from local USE of a different
	// ripdb attachment". For UPDATE/DELETE (which have no sink fallback),
	// the AST safety walker rejects unqualified source-position refs
	// outright. Surrogate test: an UPDATE whose subquery contains a
	// reference that wasn't qualified by `rip.` (and so the rewriter
	// can't prove it's our catalog) must be refused with a clear hint.
	expect_ok(con,
	          "CREATE TEMP TABLE smoke_orders AS SELECT 9100 AS id, 1 AS person_id, "
	          "'use-attack' AS sku, 'USD' AS currency, 0.0 AS amount, 0.00::DECIMAL(10,2) AS price",
	          s, "create local smoke_orders for USE-attack surrogate");
	// The error path here is the bound-plan dependency walk (`OnlyRipdbScans`)
	// rejecting the local temp-table scan in the subquery, NOT the AST safety
	// walker — DuckDB's binder attaches the source to the local temp table
	// first, so the LogicalGet is already non-ripdb_scan by the time we look.
	// Either rejection is acceptable; we just need SOMETHING to refuse.
	expect_error_contains(
	    "UPDATE rip.smoke_orders SET amount = (SELECT max(amount) FROM smoke_orders) WHERE id = 1",
	    "could not be passed through",
	    "UPDATE with unqualified subquery source (binds locally) is rejected");

	// --- Pre-rewrite source provenance: pre-existing `main.t` rejected.
	// This is the key multi-ripdb defense: a `main.t` subquery ref looks
	// fine to OnlyRipdbScans (binds to a local ripdb attachment via current
	// catalog), but if the user is doing UPDATE r.t SET ... = (SELECT ...
	// FROM main.t), the source could have been bound to a DIFFERENT
	// ripdb attachment via `USE s`. Without provenance proof, we refuse.
	// Either rejection path is acceptable: depending on the local DuckDB
	// session state, `main.smoke_orders` may bind to a non-existent local
	// table (caught by OnlyRipdbScans / "could not be passed through")
	// or to a coincidentally-named local table (caught by the provenance
	// walker / "not explicitly qualified"). Both are correct refusals;
	// the contract is "v1 refuses unqualified-source UPDATE".
	expect_error_contains(
	    "UPDATE rip.smoke_orders SET amount = (SELECT max(amount) FROM main.smoke_orders) WHERE id = 1",
	    "ripdb",
	    "UPDATE with `main.t` subquery (no rip. prefix) is refused");
	// And the explicitly-qualified form passes:
	expect_ok(con,
	          "UPDATE rip.smoke_orders SET amount = (SELECT max(amount) FROM rip.main.smoke_orders) WHERE id = 1",
	          s, "UPDATE with explicit `rip.main.t` subquery succeeds");
	expect_ok(con, "UPDATE rip.smoke_orders SET amount = 12.50 WHERE id = 1",
	          s, "restore amount on id=1 (after rip.main.t test)");

	// --- VALUES-cell scalar subquery: documented behavior across attachments.
	//
	// The dangerous-looking shape is `INSERT INTO r.t VALUES (..., (SELECT
	// FROM main.t), ...)` where `main.t` could bind (via `USE s`) to a
	// different ripdb attachment than the target. The defense is by
	// CONSTRUCTION: any INSERT whose source plan touches a non-our-catalog
	// LogicalGet (which `main.t` does when USE points elsewhere) trips
	// `OnlyRipdbScans`, falls through to the sink fallback, which
	// materializes the subquery locally via DuckDB's binder (rooted in
	// the actual `USE` catalog) and forwards only typed-literal INSERT
	// VALUES to the remote. No source ref reaches the remote at all, so
	// no mis-targeting can occur.
	//
	// Verify the sink-fallback materialization works correctly with a
	// second attachment under USE.
	expect_ok(con, std::string("ATTACH '") + rip_db_url + "' AS rip2 (TYPE ripdb)",
	          s, "ATTACH second ripdb attachment");
	expect_ok(con, "USE rip2", s, "USE rip2");
	expect_ok(con,
	          "INSERT INTO rip.smoke_orders (id, person_id, sku, currency, amount, price) "
	          "VALUES (9001, 1, 'val-sub', 'USD', "
	          "        (SELECT max(amount) FROM main.smoke_orders), 0.00)",
	          s, "INSERT VALUES with subquery routes via sink fallback (multi-attachment safe)");
	expect_ok(con, "USE memory", s, "USE memory (restore)");
	expect_ok(con, "DETACH rip2", s, "DETACH rip2");
	expect_ok(con, "DELETE FROM rip.smoke_orders WHERE id = 9001",
	          s, "cleanup: VALUES-subquery sink-fallback test row");

	// The explicitly-qualified form succeeds via passthrough:
	expect_ok(con,
	          "INSERT INTO rip.smoke_orders (id, person_id, sku, currency, amount, price) "
	          "VALUES (9002, 1, 'val-sub-ok', 'USD', "
	          "        (SELECT max(amount) FROM rip.main.smoke_orders), 0.00)",
	          s, "INSERT VALUES with explicit `rip.main.t` scalar subquery succeeds");
	expect_ok(con, "DELETE FROM rip.smoke_orders WHERE id = 9002",
	          s, "cleanup: VALUES-subquery passthrough test row");
	// INSERT...SELECT from an unqualified source is INTENTIONALLY allowed
	// because it routes to the sink fallback (the LOCAL DuckDB binder
	// resolves the source and the sink materializes those rows; the
	// remote only sees typed-literal INSERT VALUES). This is the safe
	// behavior — verify it with a row-count assertion to lock the contract.
	expect_ok(con,
	          "INSERT INTO rip.smoke_orders SELECT * FROM smoke_orders",
	          s, "INSERT...SELECT from unqualified local source uses sink fallback");
	expect_rows(con, "SELECT * FROM rip.smoke_orders WHERE id = 9100", 1,
	            s, "sink-fallback materialized the local row through to remote");
	expect_ok(con, "DELETE FROM rip.smoke_orders WHERE id = 9100", s, "cleanup");
	expect_ok(con, "DROP TABLE smoke_orders", s, "drop local smoke_orders");

	// --- /ddb/exec NUL-in-body reject (direct HTTP).
	{
		std::string host; int port = 0;
		++s.total;
		if (!ParseHostPort(rip_db_url, host, port)) {
			std::printf("FAIL  could not parse host/port for /ddb/exec NUL test\n");
		} else {
			// Body with embedded NUL after the INSERT keyword.
			std::string body = "INSERT INTO smoke_orders VALUES (9992, 1, 'ok', 'USD', 0.0, 0.00)";
			body.push_back('\0');
			body.append(" DROP TABLE smoke_orders");
			std::string resp = PostRaw(host, port, "/ddb/exec", "text/plain", body);
			if (resp.find("HTTP/1.1 400") != std::string::npos &&
			    resp.find("NUL") != std::string::npos) {
				++s.passed;
				std::printf("PASS  /ddb/exec rejects body with embedded NUL\n");
			} else {
				std::printf("FAIL  /ddb/exec accepted NUL-containing body — got: %s\n",
				            resp.empty() ? "<empty>" : resp.c_str());
			}
		}
	}
	// Confirm smoke_orders still exists.
	expect_rows(con, "SELECT * FROM rip.smoke_orders", 20,
	            s, "/ddb/exec NUL attack didn't execute the truncated trailer");

	// Local-data subquery in DELETE WHERE — Path 1 dependency walk fails
	// because the DELETE references a local table, no fallback for DELETE.
	expect_ok(con,
	          "CREATE TEMP TABLE local_ids AS SELECT 99999 AS id",
	          s, "create local_ids for subquery test");
	expect_error_contains(
	    "DELETE FROM rip.smoke_orders WHERE id IN (SELECT id FROM local_ids)",
	    "could not be passed through",
	    "DELETE referencing local subquery is rejected");
	expect_ok(con, "DROP TABLE local_ids", s, "drop local_ids");

	// UPDATE ... FROM is rejected by RejectUpdateStatement.
	expect_ok(con,
	          "CREATE TEMP TABLE local_upd AS SELECT 1 AS pid, 'newval' AS new_sku",
	          s, "create local_upd for UPDATE...FROM test");
	expect_error_contains(
	    "UPDATE rip.smoke_orders SET sku = local_upd.new_sku FROM local_upd "
	    "WHERE rip.smoke_orders.id = local_upd.pid",
	    "UPDATE ... FROM",
	    "UPDATE ... FROM local_t is rejected");
	expect_ok(con, "DROP TABLE local_upd", s, "drop local_upd");

	// Explicit BEGIN/INSERT/ROLLBACK — DML inside an explicit transaction
	// is rejected because the no-op RipTransactionManager can't honor a
	// local ROLLBACK against the remote server.
	expect_ok(con, "BEGIN", s, "BEGIN explicit transaction");
	expect_error_contains(
	    "INSERT INTO rip.smoke_orders VALUES (1400, 1, 'X', 'USD', 0.0, 0.00)",
	    "explicit transaction",
	    "INSERT inside BEGIN is rejected");
	expect_ok(con, "ROLLBACK", s, "ROLLBACK to clear transaction state");

	// =========================================================================
	// Read-path correctness regression — pre-existing 10k row limit fix.
	//
	// Before P1, the server defaulted x-duckdb-ui-result-row-limit to 10000
	// and the extension's scan path never set the header, so any scan over
	// 10k rows silently truncated. Verify by inserting a > 10k row payload
	// via the rip-db /sql endpoint (server-side, fast — bypasses our DML
	// path so we exercise just the read side).
	// =========================================================================
	{
		std::string host; int port = 0;
		if (ParseHostPort(rip_db_url, host, port)) {
			++s.total;
			// Build a 12000-row table server-side via range(). Already
			// stored in the smoke server; no DROP needed since we'll
			// drop it at the end.
			auto resp = PostSql(host, port,
			                    "CREATE OR REPLACE TABLE smoke_big AS "
			                    "SELECT i AS id, 'row-' || CAST(i AS VARCHAR) AS label "
			                    "FROM range(0, 12000) AS t(i)");
			if (resp.find("200") == std::string::npos) {
				std::printf("FAIL  could not create smoke_big — server response: %s\n", resp.c_str());
			} else {
				++s.passed;
				std::printf("PASS  seeded smoke_big (12000 rows)\n");
			}
		}
	}
	// Just confirm refresh works and surfaces > 0 tables — the exact count
	// depends on other tests' create/drop ordering, which is brittle.
	expect_ok(con, "SELECT tables_loaded FROM rip_refresh('rip')",
	          s, "rip_refresh after creating smoke_big succeeds");
	expect_rows(con, "SELECT * FROM rip.smoke_big", 12000,
	            s, "scan returns ALL 12000 rows (regression test for /ddb/run row-limit fix)");
	{
		std::string host; int port = 0;
		if (ParseHostPort(rip_db_url, host, port)) {
			PostSql(host, port, "DROP TABLE smoke_big");
		}
	}

	// M2.4 — rip_refresh('catalog_name'). Returns one stats row and
	// picks up remote schema changes without requiring DETACH + ATTACH.
	//
	// Defensive cleanup of `smoke_fresh` from any prior interrupted run
	// against the same long-lived smoke server, so the 2-table baseline
	// the assertions below depend on holds even if a previous extension_test
	// invocation crashed before reaching the cleanup at the end of this
	// block. Best effort; PostSql ignores errors.
	{
		std::string host; int port = 0;
		if (ParseHostPort(rip_db_url, host, port)) {
			PostSql(host, port, "DROP TABLE IF EXISTS smoke_fresh");
		}
	}

	expect_rows(con,
	            "SELECT * FROM rip_refresh('rip')", 1,
	            s, "rip_refresh('rip') returns one stats row");
	expect_contains(con,
	            "SELECT tables_loaded FROM rip_refresh('rip')", "2",
	            s, "rip_refresh reports 2 tables loaded");

	// Create a new remote table, then rip_refresh should surface it.
	{
		std::string host; int port = 0;
		bool parsed = ParseHostPort(rip_db_url, host, port);
		++s.total;
		if (!parsed) {
			std::printf("FAIL  could not parse host/port from %s\n", rip_db_url);
		} else {
			auto resp = PostSql(host, port,
			                    "CREATE TABLE smoke_fresh AS SELECT 42 AS answer");
			if (resp.find("200") == std::string::npos) {
				std::printf("FAIL  creating remote smoke_fresh — server response: %s\n", resp.c_str());
			} else {
				++s.passed;
				std::printf("PASS  created remote smoke_fresh via /sql\n");
			}
		}
	}

	// Without refresh, the new table is NOT visible.
	++s.total;
	{
		auto r = con.Query("SELECT * FROM rip.smoke_fresh");
		if (r->HasError()) {
			++s.passed;
			std::printf("PASS  pre-refresh: rip.smoke_fresh is not visible\n");
		} else {
			std::printf("FAIL  pre-refresh: rip.smoke_fresh should not exist yet\n");
		}
	}

	// After rip_refresh, the new table appears.
	expect_contains(con,
	            "SELECT tables_loaded FROM rip_refresh('rip')", "3",
	            s, "rip_refresh reports 3 tables loaded after CREATE TABLE");
	expect_rows(con, "SELECT * FROM rip.smoke_fresh", 1,
	            s, "post-refresh: rip.smoke_fresh is queryable");

	// Drop smoke_fresh from the remote so a re-run against the same long-
	// lived smoke server still observes a 2-table baseline. Mirrors the
	// smoke_big cleanup above. Best-effort; the test doesn't assert on this.
	{
		std::string host; int port = 0;
		if (ParseHostPort(rip_db_url, host, port)) {
			PostSql(host, port, "DROP TABLE IF EXISTS smoke_fresh");
		}
	}

	// Error paths.
	++s.total;
	{
		auto r = con.Query("SELECT * FROM rip_refresh('no_such_catalog')");
		if (r->HasError() && r->GetError().find("no attached database") != std::string::npos) {
			++s.passed;
			std::printf("PASS  rip_refresh rejects unknown catalog\n");
		} else {
			std::printf("FAIL  rip_refresh should reject unknown catalog, got: %s\n",
			            r->HasError() ? r->GetError().c_str() : "<no error>");
		}
	}

	// DETACH to exercise catalog cleanup.
	expect_ok(con, "DETACH rip", s, "DETACH rip");

	// M2.1 — predicate pushdown. Conservative subset: = != < <= > >=,
	// IS NULL, IS NOT NULL, AND of those, on INT / BOOL / VARCHAR.
	// Everything else falls back to local DuckDB filtering. Results
	// must be identical either way; we verify by running queries that
	// exercise each shape and checking row counts.
	expect_ok(con, "ATTACH '" + std::string(rip_db_url) + "' AS rip (TYPE ripdb)",
	          s, "re-ATTACH rip for pushdown tests");

	// = on INTEGER (person 5 has 2 orders).
	expect_rows(con,
	            "SELECT * FROM rip.smoke_orders WHERE person_id = 5", 2,
	            s, "M2.1 — person_id = 5 returns 2 rows");

	// != on INTEGER.
	expect_rows(con,
	            "SELECT * FROM rip.smoke_orders WHERE person_id != 5", 18,
	            s, "M2.1 — person_id != 5 returns 18 rows");

	// < / > on INTEGER.
	expect_rows(con,
	            "SELECT * FROM rip.smoke_people WHERE id < 5", 4,
	            s, "M2.1 — id < 5 returns 4 rows");
	expect_rows(con,
	            "SELECT * FROM rip.smoke_people WHERE id >= 8", 3,
	            s, "M2.1 — id >= 8 returns 3 rows");

	// = on VARCHAR (currency EUR appears every 3rd row: i=3,6,9,...,18 → 6 rows).
	expect_rows(con,
	            "SELECT * FROM rip.smoke_orders WHERE currency = 'EUR'", 6,
	            s, "M2.1 — currency = 'EUR' returns 6 rows");
	expect_rows(con,
	            "SELECT * FROM rip.smoke_orders WHERE currency = 'USD'", 14,
	            s, "M2.1 — currency = 'USD' returns 14 rows");

	// IS NOT NULL (complements the existing IS NULL case).
	expect_rows(con,
	            "SELECT * FROM rip.smoke_people WHERE birthdate IS NOT NULL", 5,
	            s, "M2.1 — birthdate IS NOT NULL returns 5 rows");

	// AND of two predicates across two columns — top-level CONJUNCTION_AND
	// arrives as separate filter entries, each pushed independently.
	expect_rows(con,
	            "SELECT * FROM rip.smoke_orders WHERE currency = 'USD' AND person_id < 5", 6,
	            s, "M2.1 — currency='USD' AND person_id<5 returns 6 rows");

	// SQL injection safety — a VARCHAR literal containing a single quote
	// must be properly escaped. `currency LIKE 'E%'` is not pushed;
	// `currency = '''; DROP TABLE...' ` must not parse-error the remote.
	expect_rows(con,
	            "SELECT * FROM rip.smoke_orders WHERE currency = 'O''Malley'", 0,
	            s, "M2.1 — quoted-literal escape works (0 rows, no injection)");

	// Swapped operands: literal on the left.
	expect_rows(con,
	            "SELECT * FROM rip.smoke_people WHERE 5 < id", 5,
	            s, "M2.1 — 5 < id (swapped) returns 5 rows");

	// Non-pushable filter must still produce correct results via local
	// fallback (DuckDB applies LIKE itself — the scan returns all rows).
	expect_rows(con,
	            "SELECT * FROM rip.smoke_orders WHERE sku LIKE 'SKU-1%'", 11,
	            s, "M2.1 — LIKE (not pushable) falls back to local, correct result");

	// Mixed: one pushable (`currency = 'USD'`) + one non-pushable (`sku LIKE`).
	// Pushable half goes remote, the LIKE is applied locally by DuckDB.
	expect_rows(con,
	            "SELECT * FROM rip.smoke_orders "
	            "WHERE currency = 'USD' AND sku LIKE 'SKU-%'", 14,
	            s, "M2.1 — mixed pushable + non-pushable filters, correct result");

	// DOUBLE comparison is deliberately NOT pushed (peer-AI guidance:
	// float semantics are subtle). Must still produce correct results.
	expect_rows(con,
	            "SELECT * FROM rip.smoke_orders WHERE amount > 100.0", 12,
	            s, "M2.1 — DOUBLE filter (not pushed) returns correct rows");

	// Risk 12 — native DECIMAL encoding.
	// smoke_orders.price is DECIMAL(10,2). Must round-trip with exact
	// precision, be exposed as DECIMAL in the catalog (not VARCHAR),
	// and participate in arithmetic and aggregation natively.
	expect_contains(con,
	            "SELECT column_type FROM (DESCRIBE rip.smoke_orders) WHERE column_name = 'price'",
	            "DECIMAL(10,2)",
	            s, "DECIMAL(10,2) surfaces as DECIMAL in the catalog");

	expect_contains(con,
	            "SELECT typeof(price) FROM rip.smoke_orders LIMIT 1",
	            "DECIMAL(10,2)",
	            s, "typeof(price) is DECIMAL(10,2) at runtime");

	// Exact-value round-trip. i=1 → 1*12.50 = 12.50
	expect_contains(con,
	            "SELECT price FROM rip.smoke_orders WHERE id = 1",
	            "12.50",
	            s, "DECIMAL round-trips 12.50 exactly");

	// Sum: 12.50 + 25.00 + 37.50 + ... + 250.00 = 12.50 * (1+2+...+20)
	//      = 12.50 * 210 = 2625.00  — exact because DECIMAL is exact.
	expect_contains(con,
	            "SELECT sum(price) FROM rip.smoke_orders",
	            "2625.00",
	            s, "DECIMAL sum is exact (2625.00)");

	// DECIMAL arithmetic round-trips DECIMAL, not DOUBLE.
	expect_contains(con,
	            "SELECT typeof(sum(price)) FROM rip.smoke_orders",
	            "DECIMAL",
	            s, "sum(DECIMAL) stays DECIMAL");

	// Count rows where DECIMAL comparison holds (checks bind-time type
	// compatibility). price > 100 matches i=9..20 → 12 rows.
	expect_rows(con,
	            "SELECT * FROM rip.smoke_orders WHERE price > 100.00", 12,
	            s, "DECIMAL > literal comparison");

	expect_ok(con, "DETACH rip", s, "DETACH rip after pushdown tests");

	// M2.6 — URL normalization. ATTACH with a noisy URL (path + query
	// string + fragment + trailing slashes) must be stripped back to
	// its canonical scheme+host+port form and still work end-to-end.
	{
		std::string noisy = std::string(rip_db_url) + "/some/path/?debug=1&foo=bar#anchor////";
		expect_ok(con, std::string("ATTACH '") + noisy + "' AS rip_noisy (TYPE ripdb)",
		          s, "ATTACH with path+query+fragment+trailing slashes");
		expect_rows(con, "SELECT * FROM rip_noisy.smoke_people", 10,
		            s, "noisy-URL attach produces the same rows");
		expect_ok(con, "DETACH rip_noisy", s, "DETACH rip_noisy");
	}

	// M2.6 — bare host:port form (no scheme) must still work.
	{
		// Derive bare form from rip_db_url by dropping the scheme if present.
		std::string bare = rip_db_url;
		auto sep = bare.find("://");
		if (sep != std::string::npos) bare = bare.substr(sep + 3);
		// Strip any path that may have sneaked in (defensive).
		auto slash = bare.find('/');
		if (slash != std::string::npos) bare = bare.substr(0, slash);
		expect_ok(con, std::string("ATTACH '") + bare + "' AS rip_bare (TYPE ripdb)",
		          s, "ATTACH with bare host:port (no scheme)");
		expect_rows(con, "SELECT * FROM rip_bare.smoke_orders", 20,
		            s, "bare-host attach produces the same rows");
		expect_ok(con, "DETACH rip_bare", s, "DETACH rip_bare");
	}

	std::printf("\n# %d / %d passed\n", s.passed, s.total);
	return (s.passed == s.total) ? 0 : 1;
}
