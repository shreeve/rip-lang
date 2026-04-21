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
#include <string>

namespace duckdb { namespace ripdb {
void Load(ExtensionLoader &loader);                 // re-declared here; defined in ripdb.cpp
} }

struct TestStats {
	int total   = 0;
	int passed  = 0;
};

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
		auto r = con.Query("INSERT INTO rip.smoke_orders VALUES (999, 1, 'nope', 'USD', 0.0)");
		if (r->HasError() && r->GetError().find("read-only") != std::string::npos) {
			++s.passed;
			std::printf("PASS  INSERT rejected with read-only error\n");
		} else {
			std::printf("FAIL  INSERT should be rejected with read-only error, got: %s\n",
			            r->HasError() ? r->GetError().c_str() : "<no error>");
		}
	}

	// DETACH to exercise catalog cleanup.
	expect_ok(con, "DETACH rip", s, "DETACH rip");

	std::printf("\n# %d / %d passed\n", s.passed, s.total);
	return (s.passed == s.total) ? 0 : 1;
}
