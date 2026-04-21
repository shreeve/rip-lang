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
std::string DechunkForTest(const std::string &in);  // M2.2 unit-test hook
} }

struct TestStats {
	int total   = 0;
	int passed  = 0;
};

// Minimal localhost HTTP POST — used only to mutate the remote schema
// during the M2.4 rip_refresh test. Returns the response body on 2xx,
// empty string on any failure (best effort; the test will assert on
// expected SQL-side effects afterward).
static std::string PostSql(const std::string &host, int port, const std::string &sql) {
	struct addrinfo hints {};
	hints.ai_family   = AF_UNSPEC;
	hints.ai_socktype = SOCK_STREAM;
	struct addrinfo *res = nullptr;
	if (getaddrinfo(host.c_str(), std::to_string(port).c_str(), &hints, &res) != 0) return {};
	int fd = -1;
	for (auto *ai = res; ai; ai = ai->ai_next) {
		fd = socket(ai->ai_family, ai->ai_socktype, ai->ai_protocol);
		if (fd >= 0 && connect(fd, ai->ai_addr, ai->ai_addrlen) == 0) break;
		if (fd >= 0) { close(fd); fd = -1; }
	}
	freeaddrinfo(res);
	if (fd < 0) return {};

	// rip-db's /sql endpoint expects JSON with a "sql" field.
	std::string body = "{\"sql\":\"";
	for (char c : sql) {
		if (c == '"' || c == '\\') body += '\\';
		body += c;
	}
	body += "\"}";
	std::string req = "POST /sql HTTP/1.1\r\n"
	                   "Host: " + host + ":" + std::to_string(port) + "\r\n"
	                   "Content-Type: application/json\r\n"
	                   "Content-Length: " + std::to_string(body.size()) + "\r\n"
	                   "Connection: close\r\n\r\n" + body;

	const char *p = req.data(); size_t left = req.size();
	while (left > 0) { ssize_t n = send(fd, p, left, 0); if (n <= 0) break; p += n; left -= (size_t)n; }

	std::string raw; char buf[4096];
	while (true) { ssize_t n = recv(fd, buf, sizeof(buf), 0); if (n <= 0) break; raw.append(buf, (size_t)n); }
	close(fd);
	return raw;
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

	// ----------------------------------------------------------------
	// M2.2 — HTTP chunked transfer-encoding decoder unit tests.
	// These exercise DechunkForTest() directly without touching the
	// live server. rip-db itself doesn't emit chunked responses today;
	// these cases cover the wire-format paths the client must handle
	// when a future rip-db / reverse-proxy does.
	// ----------------------------------------------------------------
	auto expect_dechunk = [&](const std::string &label, const std::string &in,
	                           const std::string &expected) {
		++s.total;
		try {
			auto got = duckdb::ripdb::DechunkForTest(in);
			if (got == expected) {
				++s.passed;
				std::printf("PASS  dechunker: %s\n", label.c_str());
			} else {
				std::printf("FAIL  dechunker: %s — expected %zu bytes, got %zu\n",
				            label.c_str(), expected.size(), got.size());
			}
		} catch (const std::exception &e) {
			std::printf("FAIL  dechunker: %s — threw: %s\n", label.c_str(), e.what());
		}
	};
	auto expect_dechunk_throws = [&](const std::string &label, const std::string &in,
	                                   const std::string &needle) {
		++s.total;
		try {
			duckdb::ripdb::DechunkForTest(in);
			std::printf("FAIL  dechunker: %s — expected throw, succeeded\n", label.c_str());
		} catch (const std::exception &e) {
			if (std::string(e.what()).find(needle) != std::string::npos) {
				++s.passed;
				std::printf("PASS  dechunker: %s — rejected with '%s'\n", label.c_str(), needle.c_str());
			} else {
				std::printf("FAIL  dechunker: %s — threw but message missing '%s': %s\n",
				            label.c_str(), needle.c_str(), e.what());
			}
		}
	};

	// Single chunk.
	expect_dechunk("single chunk",
	               "5\r\nhello\r\n0\r\n\r\n",
	               "hello");
	// Two chunks.
	expect_dechunk("two chunks",
	               "5\r\nhello\r\n5\r\nworld\r\n0\r\n\r\n",
	               "helloworld");
	// Chunk with chunk-ext (extension after ';' must be ignored).
	expect_dechunk("chunk-ext ignored",
	               "3;name=value\r\nabc\r\n0\r\n\r\n",
	               "abc");
	// Empty body (last-chunk only).
	expect_dechunk("empty body",
	               "0\r\n\r\n",
	               "");
	// Hex size upper/lowercase.
	expect_dechunk("hex size mixed case",
	               "A\r\n0123456789\r\n0\r\n\r\n",
	               "0123456789");
	// Large (> 1 buffer worth) chunks.
	{
		std::string big(5000, 'x');
		char hdr[32];
		std::snprintf(hdr, sizeof(hdr), "%zx\r\n", big.size());
		std::string in = std::string(hdr) + big + "\r\n0\r\n\r\n";
		expect_dechunk("5000-byte chunk", in, big);
	}
	// Trailers after 0-chunk must be tolerated (we ignore them).
	expect_dechunk("trailer fields ignored",
	               "3\r\nfoo\r\n0\r\nX-Trailer: whatever\r\n\r\n",
	               "foo");

	// Bad: non-hex chunk size.
	expect_dechunk_throws("non-hex size rejected",
	                      "zzz\r\nhi\r\n0\r\n\r\n",
	                      "bad chunk size");
	// Bad: chunk overruns buffer.
	expect_dechunk_throws("overrunning chunk rejected",
	                      "FF\r\nonly-a-few-bytes\r\n0\r\n\r\n",
	                      "overruns buffer");
	// Bad: missing CRLF after chunk data.
	expect_dechunk_throws("missing CRLF after data",
	                      "3\r\nabcXX0\r\n\r\n",
	                      "missing CRLF after chunk data");
	// Bad: truncated (no terminating 0-chunk).
	expect_dechunk_throws("truncated stream",
	                      "3\r\nabc\r\n",
	                      "truncated");

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

	// Read-only guard.
	++s.total;
	{
		auto r = con.Query("INSERT INTO rip.smoke_orders VALUES (999, 1, 'nope', 'USD', 0.0, 0.00)");
		if (r->HasError() && r->GetError().find("read-only") != std::string::npos) {
			++s.passed;
			std::printf("PASS  INSERT rejected with read-only error\n");
		} else {
			std::printf("FAIL  INSERT should be rejected with read-only error, got: %s\n",
			            r->HasError() ? r->GetError().c_str() : "<no error>");
		}
	}

	// M2.4 — rip_refresh('catalog_name'). Returns one stats row and
	// picks up remote schema changes without requiring DETACH + ATTACH.
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
