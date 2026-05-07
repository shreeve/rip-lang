// ============================================================================
// ripdb.cpp — DuckDB binding for a remote rip-db HTTP server.
//
// See packages/db/CLI.md §"Implementation progress" for the running log of
// what's landed and what's deferred.
//
// Scope:
//   - Loadable-extension entrypoint via DUCKDB_CPP_EXTENSION_ENTRY.
//   - StorageExtension('ripdb') → ATTACH dispatch.
//   - RipCatalog + RipSchemaEntry + RipTableEntry. DDL is denied; DML
//     (INSERT/UPDATE/DELETE) is forwarded to the remote via PlanInsert/
//     PlanUpdate/PlanDelete (see PhysicalRipPassthrough and
//     PhysicalRipInsertSink).
//   - Eager catalog population at attach time (one /tables + one /schema/:t
//     per table). Stable per-attach object identity so DuckDB's binder/
//     autocomplete can hold optional_ptrs without lifetime drama.
//   - RipHttpClient over DuckDB's HTTPUtil (depends on httpfs at runtime).
//   - Scan function with projection pushdown and single-threaded scan.
//     Decode uses the Commit 1 decoder; per-row writes into output vectors,
//     no memcpy fast paths anywhere yet.
//   - RipTransaction + RipTransactionManager as thin no-ops; DML inside an
//     explicit BEGIN is refused (we can't honor a local ROLLBACK against
//     the remote).
//   - All Create*/DropEntry/Alter throw PermissionException; only DML is
//     permitted to mutate.
//
// Sentinel handling:
//   - COLUMN_IDENTIFIER_ROW_ID is rejected explicitly in init_global, not
//     deep in the scan. Zero-column projections are also rejected with a
//     clear message rather than producing invalid SQL.
//   - All HTTP failure modes (non-2xx, transport errors, decode failures,
//     remote error envelope) become DuckDB exceptions, never asserts.
//
// Wire-format invariants this file relies on are owned by the Commit 1
// decoder (decoder.h / decoder.cpp). Any wire change bumps the
// fixtureFormatVersion and forces a coordinated update there first.
// ============================================================================

#include "decoder.h"

#include "duckdb.hpp"
#include "duckdb/main/extension/extension_loader.hpp"
#include "duckdb/main/database.hpp"
#include "duckdb/main/attached_database.hpp"
#include "duckdb/main/database_manager.hpp"
#include "duckdb/main/config.hpp"
#include "duckdb/storage/storage_extension.hpp"
#include "duckdb/catalog/catalog.hpp"
#include "duckdb/catalog/catalog_entry/schema_catalog_entry.hpp"
#include "duckdb/catalog/catalog_entry/table_catalog_entry.hpp"
#include "duckdb/catalog/duck_catalog.hpp"
#include "duckdb/catalog/entry_lookup_info.hpp"
#include "duckdb/transaction/transaction_manager.hpp"
#include "duckdb/transaction/transaction.hpp"
#include "duckdb/parser/parsed_data/attach_info.hpp"
#include "duckdb/parser/parsed_data/create_schema_info.hpp"
#include "duckdb/parser/parsed_data/create_table_info.hpp"
#include "duckdb/parser/column_definition.hpp"
#include "duckdb/parser/column_list.hpp"
#include "duckdb/function/table_function.hpp"
#include "duckdb/common/case_insensitive_map.hpp"
#include "duckdb/common/string_util.hpp"
#include "duckdb/common/exception.hpp"
// All DuckDB-header-layout and API-rename drift between v1.5.2 and the
// post-v1.5.2 dev tree is absorbed by ripdb_compat.hpp — this is the only
// header we need for the vector + logical-operator machinery used below.
#include "ripdb_compat.hpp"
#include "duckdb/common/types/uuid.hpp"
#include "duckdb/common/types/interval.hpp"
#include "duckdb/common/hugeint.hpp"
#include "duckdb/common/uhugeint.hpp"
#include "duckdb/storage/database_size.hpp"
#include "duckdb/storage/table_storage_info.hpp"
#include "duckdb/main/extension_helper.hpp"
#include "duckdb/main/extension_install_info.hpp"
#include "duckdb/planner/operator/logical_get.hpp"
#include "duckdb/planner/operator/logical_insert.hpp"
#include "duckdb/planner/operator/logical_update.hpp"
#include "duckdb/planner/operator/logical_delete.hpp"
#include "duckdb/planner/operator/logical_dummy_scan.hpp"
#include "duckdb/planner/operator/logical_expression_get.hpp"
#include "duckdb/planner/expression.hpp"
#include "duckdb/planner/expression_iterator.hpp"
#include "duckdb/planner/expression/bound_comparison_expression.hpp"
#include "duckdb/planner/expression/bound_conjunction_expression.hpp"
#include "duckdb/planner/expression/bound_operator_expression.hpp"
#include "duckdb/planner/expression/bound_columnref_expression.hpp"
#include "duckdb/planner/expression/bound_constant_expression.hpp"
#include "duckdb/planner/expression/bound_subquery_expression.hpp"
#include "duckdb/common/types/value.hpp"
#include "duckdb/common/enums/expression_type.hpp"
#include "duckdb/common/enums/physical_operator_type.hpp"
#include "duckdb/parser/parser.hpp"
#include "duckdb/parser/sql_statement.hpp"
#include "duckdb/parser/statement/insert_statement.hpp"
#include "duckdb/parser/statement/update_statement.hpp"
#include "duckdb/parser/statement/delete_statement.hpp"
#include "duckdb/parser/statement/select_statement.hpp"
#include "duckdb/parser/tableref/basetableref.hpp"
#include "duckdb/parser/tableref/joinref.hpp"
#include "duckdb/parser/tableref/subqueryref.hpp"
#include "duckdb/parser/tableref/expressionlistref.hpp"
#include "duckdb/parser/query_node/select_node.hpp"
#include "duckdb/parser/query_node/set_operation_node.hpp"
#include "duckdb/parser/query_node/cte_node.hpp"
#include "duckdb/parser/common_table_expression_info.hpp"
#include "duckdb/parser/result_modifier.hpp"
#include "duckdb/parser/expression/columnref_expression.hpp"
#include "duckdb/parser/expression/subquery_expression.hpp"
#include "duckdb/parser/parsed_expression_iterator.hpp"
#include "duckdb/execution/physical_operator.hpp"
#include "duckdb/execution/physical_plan_generator.hpp"
#include "yyjson.hpp"

#include <cstring>
#include <cstdio>
#include <cerrno>
#include <cstdlib>
#include <cmath>
#include <limits>
#include <sstream>

// Minimal HTTP/1.1 client (BSD sockets). Local-only by design — no TLS, no
// redirects, no chunked transfer encoding. See RipHttpClient below.
#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

namespace duckdb {
namespace ripdb {

// Pull the Commit-1 decoder types into this namespace so we don't have to
// fully-qualify `::ripdb::Cell` everywhere. The decoder lives in its own
// top-level `ripdb` namespace (outside DuckDB); our extension namespace is
// `duckdb::ripdb`, which would otherwise shadow it via ADL.
using ::ripdb::Cell;
using ::ripdb::DecodedResult;
using ::ripdb::decode;
using ::ripdb::DecodeError;

// ---------------------------------------------------------------------------
// Connection options + simple HTTP client wrapper.
// ---------------------------------------------------------------------------

struct RipConnOptions {
	string   base_url;           // e.g. "http://localhost:4213" — no trailing slash
	string   host;               // derived: "localhost"
	uint16_t port         = 80;  // derived
	uint64_t timeout_seconds = 30;
};

static string RstripSlashes(const string &s) {
	auto end = s.size();
	while (end > 0 && s[end - 1] == '/') --end;
	return s.substr(0, end);
}

// Normalize an ATTACH URL down to just the scheme+host+port that the HTTP
// client actually cares about. Drops — in order — fragment (#...), query
// string (?...), path component (first '/' after the scheme), and any
// trailing slashes. Accepts all three forms the extension recognizes
// (http://, rip://, bare host[:port]).
//
// Rationale (CLI.md §M1 "URL normalization handled" — deferred to M2):
// rip-db's endpoints are absolute paths (/tables, /schema/:t, /ddb/run),
// so any path component in the attach URL is irrelevant. Rather than
// ignoring it silently mid-request, we strip it at parse time so the
// stored base_url is canonical. A future milestone can add optional
// path-prefix support by preserving the path and prepending it to
// request paths — not needed today.
static string NormalizeUrl(const string &raw) {
	string s = raw;
	// Fragment.
	size_t hash_pos = s.find('#');
	if (hash_pos != string::npos) s.erase(hash_pos);
	// Query string.
	size_t q_pos = s.find('?');
	if (q_pos != string::npos) s.erase(q_pos);
	// Path (first '/' after the scheme, if any). Bare host[:port] has no
	// scheme; treat the first '/' as the path start in that case too.
	size_t scheme_end = s.find("://");
	size_t host_start = (scheme_end == string::npos) ? 0 : scheme_end + 3;
	size_t path_start = s.find('/', host_start);
	if (path_start != string::npos) s.erase(path_start);
	return RstripSlashes(s);
}

// Parse a minimal host/port URL. Accepted shapes:
//   http://host[:port]     — the long-term UX per CLI.md, but currently
//                            blocked by DuckDB's EXTENSION_FILE_PREFIXES
//                            auto-mapping of http:// to the httpfs extension,
//                            which runs BEFORE the (TYPE ripdb) clause and
//                            requires httpfs to be available (Risk 11).
//   rip://host[:port]      — M1 smoke path. `rip` is not in the prefix
//                            table, so IsRemoteFile returns false and no
//                            autoload is attempted. We treat it as http.
//   host[:port]            — same as rip://host[:port]. Extension supplies
//                            its own URL parsing either way.
//
// No TLS support in M1 — see the "localhost-only" scope declared in CLI.md.
static bool ParseHttpUrl(const string &url, string &host_out, uint16_t &port_out) {
	string rest;
	static const string HTTP = "http://";
	static const string RIP  = "rip://";
	if (url.size() >= HTTP.size() && url.compare(0, HTTP.size(), HTTP) == 0) {
		rest = url.substr(HTTP.size());
	} else if (url.size() >= RIP.size() && url.compare(0, RIP.size(), RIP) == 0) {
		rest = url.substr(RIP.size());
	} else {
		// Bare host[:port]. No other schemes (https, ftp, ...) are accepted in M1.
		if (url.find("://") != string::npos) return false;
		rest = url;
	}
	// Host portion ends at the first '/' after the scheme, or end of string.
	size_t host_end = rest.find('/');
	if (host_end == string::npos) host_end = rest.size();
	string host_port = rest.substr(0, host_end);
	size_t colon = host_port.find(':');
	if (colon == string::npos) {
		host_out = host_port;
		port_out = 80;
	} else {
		host_out = host_port.substr(0, colon);
		long p = std::strtol(host_port.c_str() + colon + 1, nullptr, 10);
		if (p <= 0 || p > 65535) return false;
		port_out = static_cast<uint16_t>(p);
	}
	return !host_out.empty();
}

// ---------------------------------------------------------------------------
// RipHttpClient — minimal HTTP/1.1 client over BSD sockets.
//
// Scope by design: localhost / LAN over plain HTTP. No TLS, no redirects, no
// chunked transfer encoding. This is deliberate for M1 per CLI.md §"HTTP
// transport via HTTPUtil (no vendored HTTP client)" (Risk 11): using
// DuckDB's HTTPUtil creates a runtime dependency on the httpfs extension
// being available in whichever DuckDB binary loads us. For localhost-only
// M1 we sidestep that entirely. When we need TLS/remote, we'll swap this
// out for HTTPUtil once httpfs availability is a promise we can make.
// ---------------------------------------------------------------------------

class RipHttpClient {
public:
	RipHttpClient(DatabaseInstance &, RipConnOptions options) : options_(std::move(options)) {
		if (!ParseHttpUrl(options_.base_url, options_.host, options_.port)) {
			throw InvalidInputException(
			    "ripdb: unsupported URL '%s'. M1 supports plain http://host[:port] only.",
			    options_.base_url);
		}
	}

	string GetText(const string &path) {
		string req = "GET " + path + " HTTP/1.1\r\n"
		             "Host: " + options_.host + ":" + std::to_string(options_.port) + "\r\n"
		             "User-Agent: ripdb/0.1\r\n"
		             "Accept: */*\r\n"
		             "Connection: close\r\n"
		             "\r\n";
		return DoRequest("GET", path, req);
	}

	string PostBinary(const string &path, const string &content_type, const string &body,
	                  const vector<std::pair<string, string>> &extra_headers = {}) {
		string req = "POST " + path + " HTTP/1.1\r\n"
		             "Host: " + options_.host + ":" + std::to_string(options_.port) + "\r\n"
		             "User-Agent: ripdb/0.1\r\n"
		             "Content-Type: " + content_type + "\r\n"
		             "Content-Length: " + std::to_string(body.size()) + "\r\n";
		for (const auto &kv : extra_headers) {
			req += kv.first + ": " + kv.second + "\r\n";
		}
		req += "Connection: close\r\n\r\n";
		req.append(body);
		return DoRequest("POST", path, req);
	}

	const RipConnOptions &options() const { return options_; }

private:
	string DoRequest(const char *verb, const string &path, const string &raw_request) {
		int fd = ConnectTo(options_.host, options_.port);
		if (fd < 0) {
			throw IOException("ripdb: %s %s — connect to %s:%d failed: %s",
			                   verb, path, options_.host, options_.port, SafeStrerror(errno));
		}
		struct CloseGuard { int fd; ~CloseGuard() { if (fd >= 0) ::close(fd); } } guard { fd };

		const char *p    = raw_request.data();
		size_t      left = raw_request.size();
		while (left > 0) {
			ssize_t n = ::send(fd, p, left, 0);
			if (n < 0) {
				if (errno == EINTR) continue;
				throw IOException("ripdb: %s %s — send failed: %s", verb, path, SafeStrerror(errno));
			}
			p    += n;
			left -= (size_t)n;
		}

		// Slurp entire response.
		string raw;
		char   buf[16384];
		while (true) {
			ssize_t n = ::recv(fd, buf, sizeof(buf), 0);
			if (n == 0) break;
			if (n < 0) {
				if (errno == EINTR) continue;
				throw IOException("ripdb: %s %s — recv failed: %s", verb, path, SafeStrerror(errno));
			}
			raw.append(buf, (size_t)n);
		}

		size_t header_end = raw.find("\r\n\r\n");
		if (header_end == string::npos) {
			throw IOException("ripdb: %s %s — malformed HTTP response (no header terminator)",
			                   verb, path);
		}
		string head = raw.substr(0, header_end);
		string body = raw.substr(header_end + 4);

		// Status line: "HTTP/1.1 200 OK"
		size_t sp1 = head.find(' ');
		size_t sp2 = head.find(' ', sp1 + 1);
		if (sp1 == string::npos || sp2 == string::npos) {
			throw IOException("ripdb: %s %s — malformed HTTP status line", verb, path);
		}
		int status = std::atoi(head.c_str() + sp1 + 1);

		// We don't support Transfer-Encoding: chunked. rip-db doesn't emit
		// it, and supporting an unused code path was net negative (see
		// "M2.2 + M2.5 revert" rationale in CLI.md). If a proxy inserts
		// chunked in front of rip-db someday, revisit as part of M3's
		// streaming decoder work.
		string lower = StringUtil::Lower(head);
		if (lower.find("transfer-encoding:") != string::npos &&
		    lower.find("chunked") != string::npos) {
			throw IOException(
			    "ripdb: %s %s — Transfer-Encoding: chunked is not supported",
			    verb, path);
		}

		// Respect Content-Length if present — some servers over-send when
		// the connection is kept alive; but with Connection: close above
		// it should match body length regardless.
		size_t cl_pos = lower.find("content-length:");
		if (cl_pos != string::npos) {
			size_t val_start = cl_pos + strlen("content-length:");
			while (val_start < lower.size() && (lower[val_start] == ' ' || lower[val_start] == '\t')) ++val_start;
			long claimed = std::strtol(lower.c_str() + val_start, nullptr, 10);
			if (claimed >= 0 && static_cast<size_t>(claimed) < body.size()) {
				body.resize(static_cast<size_t>(claimed));
			}
		}

		if (status < 200 || status >= 300) {
			throw IOException("ripdb: %s %s returned HTTP %d\n%s", verb, path, status, body);
		}
		return body;
	}

	static int ConnectTo(const string &host, uint16_t port) {
		struct addrinfo hints{};
		hints.ai_family   = AF_UNSPEC;
		hints.ai_socktype = SOCK_STREAM;
		struct addrinfo *res = nullptr;
		string port_str = std::to_string(port);
		if (::getaddrinfo(host.c_str(), port_str.c_str(), &hints, &res) != 0 || !res) {
			errno = EHOSTUNREACH;
			return -1;
		}
		struct AddrinfoGuard { struct addrinfo *p; ~AddrinfoGuard() { if (p) ::freeaddrinfo(p); } } g { res };

		for (auto *ai = res; ai; ai = ai->ai_next) {
			int fd = ::socket(ai->ai_family, ai->ai_socktype, ai->ai_protocol);
			if (fd < 0) continue;
			if (::connect(fd, ai->ai_addr, ai->ai_addrlen) == 0) {
				return fd;
			}
			::close(fd);
		}
		return -1;
	}

	static const char *SafeStrerror(int err) {
		const char *s = std::strerror(err);
		return s ? s : "unknown error";
	}

	RipConnOptions options_;
};

// ---------------------------------------------------------------------------
// Type mapping. Mirror of mapDuckDBType in packages/db/lib/duckdb-binary.rip.
// Anything the encoder would stringify on the wire is exposed as VARCHAR
// in the catalog. BLOB is refused at catalog-population time per CLI.md
// (silent byte-mangling is worse than a clear error).
// ---------------------------------------------------------------------------

struct CatalogTypeResult {
	bool refuse = false;          // true → emit a populate-time error for this column
	string refuse_reason;
	LogicalType type = LogicalType::VARCHAR;
	// True iff the catalog type is VARCHAR but the REMOTE column is NOT a
	// real VARCHAR (LIST/STRUCT/MAP/ARRAY/UNION/ENUM/JSON/BIT/...). The
	// DML write path needs this to refuse INSERTs that would silently
	// stringify into a column that doesn't actually want a string.
	bool varchar_is_fallback = false;
};

// Parse "DECIMAL(w,s)" (whitespace-tolerant) into width + scale. Returns
// false for a non-DECIMAL string or a syntactically invalid one. Bare
// "DECIMAL" with no parens matches DuckDB's DEFAULT precision (18, 3).
static bool ParseDecimalWidthScale(const string &type_upper, uint8_t &width, uint8_t &scale) {
	if (type_upper.compare(0, 7, "DECIMAL") != 0) return false;
	// Bare DECIMAL → DuckDB default
	size_t after = 7;
	while (after < type_upper.size() && (type_upper[after] == ' ' || type_upper[after] == '\t')) ++after;
	if (after >= type_upper.size() || type_upper[after] != '(') {
		width = 18; scale = 3;
		return true;
	}
	++after;  // consume '('
	auto skip_ws = [&]() {
		while (after < type_upper.size() && (type_upper[after] == ' ' || type_upper[after] == '\t')) ++after;
	};
	auto parse_uint = [&](uint32_t &out) {
		skip_ws();
		size_t start = after;
		while (after < type_upper.size() && type_upper[after] >= '0' && type_upper[after] <= '9') ++after;
		if (after == start) return false;
		out = static_cast<uint32_t>(std::strtoul(type_upper.c_str() + start, nullptr, 10));
		return true;
	};
	uint32_t w = 0, s = 0;
	if (!parse_uint(w)) return false;
	skip_ws();
	if (after >= type_upper.size() || type_upper[after] != ',') return false;
	++after;
	if (!parse_uint(s)) return false;
	skip_ws();
	if (after >= type_upper.size() || type_upper[after] != ')') return false;
	if (w == 0 || w > 38 || s > w) return false;
	width = static_cast<uint8_t>(w);
	scale = static_cast<uint8_t>(s);
	return true;
}

static CatalogTypeResult MapToWireType(const string &server_reported_type) {
	CatalogTypeResult r;
	string upper = StringUtil::Upper(server_reported_type);
	auto starts_with = [&](const char *prefix) {
		size_t n = std::strlen(prefix);
		return upper.size() >= n && upper.compare(0, n, prefix) == 0;
	};

	if (upper == "BLOB" || upper == "BYTEA" || upper == "BINARY" || upper == "VARBINARY") {
		r.refuse = true;
		r.refuse_reason = "BLOB columns are not supported by the ripdb extension "
		                  "(server-side stringification is lossy; refused per CLI.md).";
		return r;
	}

	// DECIMAL(W,S) — native wire encoding in M2.
	if (starts_with("DECIMAL")) {
		uint8_t w = 18, s = 3;
		if (!ParseDecimalWidthScale(upper, w, s)) {
			r.refuse = true;
			r.refuse_reason = StringUtil::Format(
			    "ripdb: could not parse DECIMAL precision from '%s'", server_reported_type);
			return r;
		}
		r.type = LogicalType::DECIMAL(w, s);
		return r;
	}

	if (upper == "BOOLEAN" || upper == "BOOL")                  { r.type = LogicalType::BOOLEAN;        return r; }
	if (upper == "TINYINT" || upper == "INT1")                  { r.type = LogicalType::TINYINT;        return r; }
	if (upper == "SMALLINT" || upper == "INT2")                 { r.type = LogicalType::SMALLINT;       return r; }
	if (upper == "INTEGER" || upper == "INT" || upper == "INT4" || upper == "SIGNED")
	                                                            { r.type = LogicalType::INTEGER;        return r; }
	if (upper == "BIGINT" || upper == "INT8" || upper == "LONG"){ r.type = LogicalType::BIGINT;         return r; }
	if (upper == "UTINYINT")                                    { r.type = LogicalType::UTINYINT;       return r; }
	if (upper == "USMALLINT")                                   { r.type = LogicalType::USMALLINT;      return r; }
	if (upper == "UINTEGER" || upper == "UINT")                 { r.type = LogicalType::UINTEGER;       return r; }
	if (upper == "UBIGINT")                                     { r.type = LogicalType::UBIGINT;        return r; }
	if (upper == "HUGEINT")                                     { r.type = LogicalType::HUGEINT;        return r; }
	if (upper == "UHUGEINT")                                    { r.type = LogicalType::UHUGEINT;       return r; }
	if (upper == "FLOAT" || upper == "FLOAT4" || upper == "REAL")
	                                                            { r.type = LogicalType::FLOAT;          return r; }
	if (upper == "DOUBLE" || upper == "FLOAT8" || upper == "NUMERIC")
	                                                            { r.type = LogicalType::DOUBLE;         return r; }
	if (upper == "DATE")                                        { r.type = LogicalType::DATE;           return r; }
	if (upper == "TIME")                                        { r.type = LogicalType::TIME;           return r; }
	if (upper == "TIMESTAMP" || upper == "DATETIME")            { r.type = LogicalType::TIMESTAMP;      return r; }
	if (upper == "TIMESTAMP_S" || upper == "TIMESTAMP_SEC")     { r.type = LogicalType::TIMESTAMP_S;    return r; }
	if (upper == "TIMESTAMP_MS")                                { r.type = LogicalType::TIMESTAMP_MS;   return r; }
	if (upper == "TIMESTAMP_NS")                                { r.type = LogicalType::TIMESTAMP_NS;   return r; }
	if (upper == "TIMESTAMP WITH TIME ZONE" || upper == "TIMESTAMPTZ" || upper == "TIMESTAMP_TZ")
	                                                            { r.type = LogicalType::TIMESTAMP_TZ;   return r; }
	if (upper == "TIME WITH TIME ZONE" || upper == "TIMETZ" || upper == "TIME_TZ")
	                                                            { r.type = LogicalType::TIME_TZ;        return r; }
	if (upper == "TIME_NS")                                     { r.type = LogicalType::TIME_NS;        return r; }
	if (upper == "UUID")                                        { r.type = LogicalType::UUID;           return r; }
	if (upper == "INTERVAL")                                    { r.type = LogicalType::INTERVAL;       return r; }
	if (upper == "VARCHAR" || upper == "TEXT" || upper == "STRING" || upper == "CHAR" || upper == "BPCHAR")
	                                                            { r.type = LogicalType::VARCHAR;        return r; }

	// Fallback-to-VARCHAR types (the encoder stringifies these). We expose
	// VARCHAR in the catalog so the binder/planner doesn't promise a type
	// the wire can't deliver. See CLI.md "Types that fall back to VARCHAR".
	// DECIMAL was on this list in M1; M2.1-follow-up gives it native
	// encoding (see the DECIMAL branch above), so it's out of this list.
	//
	// Two sub-cases:
	//   - real VARCHAR/CHAR — exposed as VARCHAR; DML can write to them.
	//   - everything else (LIST/STRUCT/MAP/ARRAY/UNION/ENUM/JSON/BIT/...) —
	//     ALSO exposed as VARCHAR for the read path (the wire stringifies
	//     them), but the underlying remote column is NOT a real string.
	//     DML must refuse to write to these because we can't reliably
	//     serialize a value back into the native form. Mark them so the
	//     INSERT/UPDATE path can throw a clear error instead of silently
	//     coercing.
	if (starts_with("VARCHAR") || starts_with("CHAR(")) {
		r.type = LogicalType::VARCHAR;
		return r;
	}
	if (upper == "ENUM" || starts_with("LIST(") || upper == "LIST" ||
	    starts_with("STRUCT(") || upper == "STRUCT" || starts_with("MAP(") || upper == "MAP" ||
	    starts_with("UNION(") || upper == "UNION" || starts_with("ARRAY(") || upper == "ARRAY" ||
	    upper == "BIT" || upper == "BITSTRING" || upper == "JSON" || upper == "VARIANT" ||
	    upper == "GEOMETRY") {
		r.type = LogicalType::VARCHAR;
		r.varchar_is_fallback = true;
		return r;
	}

	// Unknown — also expose as VARCHAR. Better than crashing. Treat as a
	// fallback (not a real string) so DML refuses to write through the
	// catalog's VARCHAR mask.
	r.type = LogicalType::VARCHAR;
	r.varchar_is_fallback = true;
	return r;
}

// ---------------------------------------------------------------------------
// Identifier quoting for remote SQL emission.
// ---------------------------------------------------------------------------

static string QuoteIdentifier(const string &id) {
	string out;
	out.reserve(id.size() + 2);
	out.push_back('"');
	for (char c : id) {
		if (c == '"') out.append("\"\"");
		else          out.push_back(c);
	}
	out.push_back('"');
	return out;
}

// ---------------------------------------------------------------------------
// Catalog metadata DTOs.
// ---------------------------------------------------------------------------

struct RipColumnMeta {
	string      name;       // remote-canonical (used when emitting SQL)
	LogicalType type;       // wire-compatible (after MapToWireType)
	bool        varchar_is_fallback = false; // true → catalog says VARCHAR but remote is native nested/binary
};

struct RipTableMeta {
	string                  name;
	vector<RipColumnMeta>   columns;
	bool                    refused = false;
	string                  refuse_reason;
};

// ---------------------------------------------------------------------------
// Forward decls.
// ---------------------------------------------------------------------------

class RipCatalog;
class RipSchemaEntry;
class RipTableEntry;

// ---------------------------------------------------------------------------
// Scan function — one per-table function, parameterized via bind data.
// ---------------------------------------------------------------------------

struct RipScanBindData : public TableFunctionData {
	string                base_url;
	string                schema_name;     // remote-side schema (currently always "main")
	string                table_name;      // remote-canonical
	// Back-pointer to the catalog entry. Required for `LogicalGet::GetTable()`
	// to surface us as a base-table source — without it, the binder rejects
	// UPDATE/DELETE with "Can only update base table" before our PlanUpdate
	// runs. Set in RipTableEntry::GetScanFunction; cleared/refreshed when
	// rip_refresh swaps the schema (the bind_data outlives a single query
	// only, so this pointer is safe for the duration of any one statement).
	optional_ptr<TableCatalogEntry> entry;
	// Full table column metadata in remote-declared order (NOT projected).
	vector<string>        all_column_names;
	vector<LogicalType>   all_column_types;
	// Predicate pushdown (M2.1). Each entry is a parenthesized SQL
	// fragment, AND-combined at scan time. Populated by
	// RipPushdownFilter (complex-filter callback) with only the
	// subset of filters we can translate safely. Filters that don't
	// translate are left in the caller's filter vector and applied
	// locally by DuckDB after the scan. See CLI.md §M2.1.
	vector<string>        pushed_wheres;

	RipScanBindData(string base_url_p, string schema_name_p, string table_name_p,
	                vector<string> names, vector<LogicalType> types)
	    : base_url(std::move(base_url_p)), schema_name(std::move(schema_name_p)),
	      table_name(std::move(table_name_p)), all_column_names(std::move(names)),
	      all_column_types(std::move(types)) {
	}
};

// Surface our table as a base-table for the binder. Without this, the binder
// rejects UPDATE/DELETE with "Can only update base table" because
// `LogicalGet::GetTable()` returns nullptr for any TableFunction that doesn't
// set get_bind_info. Signature mirrors v1.5.2's
// `table_function_get_bind_info_t = BindInfo(*)(const optional_ptr<FunctionData>)`
// — note this is the v1.5.2 form (no `const FunctionData` inside the
// optional_ptr); the post-1.5.2 dev tree tightens it. We pin to v1.5.2 here.
static BindInfo RipScanGetBindInfo(const optional_ptr<FunctionData> bind_data) {
	if (bind_data) {
		auto &bd = bind_data->Cast<RipScanBindData>();
		if (bd.entry) {
			// BindInfo's TableCatalogEntry& ctor wants non-const; bd.entry
			// is optional_ptr<TableCatalogEntry> (already non-const inside),
			// but `bind_data->Cast<>()` returns const-ref (the param above
			// is `const optional_ptr<FunctionData>` per the v1.5.2 typedef,
			// so the indirection chain ends up const). Drop the const
			// safely — the BindInfo just stores the pointer; it doesn't
			// mutate the table.
			auto &mut_entry = const_cast<TableCatalogEntry &>(*bd.entry);
			return BindInfo(mut_entry);
		}
	}
	return BindInfo(ScanType::TABLE);
}

struct RipScanGlobalState : public GlobalTableFunctionState {
	// Per-output-column resolution. Entry i matches DataChunk column i.
	//   remote_idx == ROWID_SLOT → synthesize sequential BIGINT locally.
	//   else                     → copy from decoded column `decoded_idx`.
	static constexpr idx_t ROWID_SLOT = static_cast<idx_t>(-1);

	struct OutCol {
		idx_t remote_idx  = 0;   // index into bind.all_column_names (when not ROWID_SLOT)
		idx_t decoded_idx = 0;   // index into decoded chunk.columns (only set for non-rowid)
	};
	vector<OutCol>         out_cols;

	// The distinct real (non-rowid) columns we actually project from the remote.
	vector<idx_t>          remote_projected_ids;

	// Decoder owns the full HTTP response body. Strings handed to vectors
	// are copied into DuckDB's heap via StringVector::AddString.
	unique_ptr<DecodedResult> decoded;
	idx_t                     chunk_cursor   = 0;
	idx_t                     row_cursor     = 0;      // within current chunk
	int64_t                   emitted_rows   = 0;      // for synthetic rowids

	// M2.3 — parallel scan. Deliberately disabled in M2: we have no
	// generic correctness-preserving partitioning strategy (OFFSET/
	// LIMIT requires stable ordering and has pathological cost on
	// large offsets; key-range needs per-table PK metadata we don't
	// surface; hash-partitioning needs server-side cooperation).
	// rip-db also serializes /ddb/run requests behind a single DuckDB
	// instance today, so N-way fanout would only overlap network
	// latency — marginal on localhost. True parallel scan lands when
	// either (a) rip-db advertises per-table partition support, or
	// (b) the remote scan moves to streaming decode with work-stealing.
	idx_t MaxThreads() const override { return 1; }
};

static unique_ptr<FunctionData>
RipScanBind(ClientContext &context, TableFunctionBindInput &input,
            vector<LogicalType> &return_types, vector<string> &names);

static unique_ptr<GlobalTableFunctionState>
RipScanInitGlobal(ClientContext &context, TableFunctionInitInput &input);

static void RipScanFunction(ClientContext &context, TableFunctionInput &input, DataChunk &output);

// ---------------------------------------------------------------------------
// M2.1 — predicate pushdown.
//
// Conservative safe subset per CLI.md / peer-AI design review (GPT-5.4):
//   translate:  = != < <= > >=  (column vs literal)
//               IS NULL, IS NOT NULL
//               AND of translatable children
//   skip:       OR (even when all branches translate — partial-OR is unsound;
//                   full-OR has 3VL NULL risk we don't want to inherit in M2)
//               LIKE/regex, function calls, column-vs-column,
//               non-literal RHS, timestamp/float/decimal/date (remote SQL
//               literal semantics not proven equivalent enough yet)
//
// Columns currently pushable: integer family (TINYINT..BIGINT + unsigned),
// BOOLEAN, VARCHAR. Everything else → we return false, DuckDB applies the
// filter locally after the scan. This is partial pushdown via the
// `pushdown_complex_filter` callback — filters we consume are REMOVED
// from the caller's vector; anything we leave behind DuckDB handles.
// ---------------------------------------------------------------------------

static bool IsSafePushdownType(const LogicalType &t) {
	switch (t.id()) {
	case LogicalTypeId::TINYINT:
	case LogicalTypeId::SMALLINT:
	case LogicalTypeId::INTEGER:
	case LogicalTypeId::BIGINT:
	case LogicalTypeId::UTINYINT:
	case LogicalTypeId::USMALLINT:
	case LogicalTypeId::UINTEGER:
	case LogicalTypeId::UBIGINT:
	case LogicalTypeId::BOOLEAN:
	case LogicalTypeId::VARCHAR:
		return true;
	default:
		return false;
	}
}

// Format a Value as a SQL literal safe for inclusion in a WHERE clause.
// Returns false for unsupported types or NULL constants (comparison
// against NULL in SQL is 3VL-unsound; DuckDB's IS NULL / IS NOT NULL
// filters are how NULL-testing actually arrives, and those have their
// own translation path).
static bool FormatLiteralSQL(const Value &v, string &out) {
	if (v.IsNull()) return false;
	switch (v.type().id()) {
	case LogicalTypeId::TINYINT:
		out = std::to_string(v.GetValue<int8_t>());  return true;
	case LogicalTypeId::SMALLINT:
		out = std::to_string(v.GetValue<int16_t>()); return true;
	case LogicalTypeId::INTEGER:
		out = std::to_string(v.GetValue<int32_t>()); return true;
	case LogicalTypeId::BIGINT:
		out = std::to_string(v.GetValue<int64_t>()); return true;
	case LogicalTypeId::UTINYINT:
		out = std::to_string(v.GetValue<uint8_t>());  return true;
	case LogicalTypeId::USMALLINT:
		out = std::to_string(v.GetValue<uint16_t>()); return true;
	case LogicalTypeId::UINTEGER:
		out = std::to_string(v.GetValue<uint32_t>()); return true;
	case LogicalTypeId::UBIGINT:
		out = std::to_string(v.GetValue<uint64_t>()); return true;
	case LogicalTypeId::BOOLEAN:
		out = v.GetValue<bool>() ? "TRUE" : "FALSE"; return true;
	case LogicalTypeId::VARCHAR: {
		auto s = v.GetValue<string>();
		string escaped;
		escaped.reserve(s.size() + 2);
		escaped.push_back('\'');
		for (char c : s) {
			if (c == '\'') escaped.append("''");
			else           escaped.push_back(c);
		}
		escaped.push_back('\'');
		out = std::move(escaped);
		return true;
	}
	default:
		return false;
	}
}

// ---------------------------------------------------------------------------
// FormatLiteralForDML
//
// Target-type-aware SQL literal formatter used by the INSERT VALUES sink
// fallback. This is intentionally a SEPARATE function from the read-side
// FormatLiteralSQL above:
//
//   - FormatLiteralSQL is conservative: it refuses anything whose remote
//     literal semantics can't be proven equivalent to DuckDB's local
//     semantics (DATE, TIMESTAMP*, FLOAT, DOUBLE, DECIMAL, …). A bad
//     read-pushdown literal returns wrong rows; that's bad but recoverable.
//
//   - FormatLiteralForDML must handle every native catalog type we expose,
//     because failing here means a DML statement either errors out at the
//     server or, worse, writes wrong data. Mutations are not recoverable.
//
// Two non-negotiable invariants enforced by this function:
//
//   1. Format against the **target column type**, not the runtime Value
//      type. A value arriving as INTEGER bound to a DECIMAL(18,2) column
//      must be cast to DECIMAL(18,2) explicitly so the remote parser
//      doesn't infer an arbitrary precision and silently truncate.
//
//   2. NULLs are always emitted as NULL::<target_type>. Bare NULL inside
//      a multi-row VALUES clause poisons type inference for the whole
//      column.
//
// Returns false (with `out` cleared) when the type isn't yet supported by
// the DML write path. Caller must then either fall through to a different
// strategy or abort the statement with a clear NotImplementedException.
// ---------------------------------------------------------------------------

static string EscapeSqlSingleQuoted(const string &s) {
	string out;
	out.reserve(s.size() + 2);
	out.push_back('\'');
	for (char c : s) {
		if (c == '\'') out.append("''");
		else           out.push_back(c);
	}
	out.push_back('\'');
	return out;
}

static bool FormatLiteralForDML(const Value &v, const LogicalType &target, string &out) {
	out.clear();
	// NULL: always cast to the target so multi-row VALUES type inference
	// doesn't pick a different type for the column.
	if (v.IsNull()) {
		out = "NULL::" + target.ToString();
		return true;
	}

	// Coerce the runtime Value to the target type when they differ. The
	// DefaultCastAs path is what the planner would do anyway during
	// execution; doing it here lets us emit the canonical typed literal.
	const Value *coerced_ptr = &v;
	Value coerced;
	if (v.type().id() != target.id()) {
		try {
			coerced = v.DefaultCastAs(target, /*strict=*/false);
			coerced_ptr = &coerced;
		} catch (...) {
			// Cast failed; bail and let the caller decide.
			return false;
		}
	}
	const Value &val = *coerced_ptr;

	switch (target.id()) {
	case LogicalTypeId::BOOLEAN:
		out = val.GetValue<bool>() ? "TRUE" : "FALSE";
		return true;

	case LogicalTypeId::TINYINT:
		out = std::to_string(val.GetValue<int8_t>());  return true;
	case LogicalTypeId::SMALLINT:
		out = std::to_string(val.GetValue<int16_t>()); return true;
	case LogicalTypeId::INTEGER:
		out = std::to_string(val.GetValue<int32_t>()); return true;
	case LogicalTypeId::BIGINT: {
		// BIGINT min: bare `-9223372036854775808` parses as unary minus on
		// a positive literal that overflows i64. Quote-and-cast instead.
		int64_t x = val.GetValue<int64_t>();
		if (x == std::numeric_limits<int64_t>::min()) {
			out = "'-9223372036854775808'::BIGINT";
		} else {
			out = std::to_string(x);
		}
		return true;
	}
	case LogicalTypeId::UTINYINT:
		out = std::to_string(val.GetValue<uint8_t>());  return true;
	case LogicalTypeId::USMALLINT:
		out = std::to_string(val.GetValue<uint16_t>()); return true;
	case LogicalTypeId::UINTEGER:
		out = std::to_string(val.GetValue<uint32_t>()); return true;
	case LogicalTypeId::UBIGINT:
		out = std::to_string(val.GetValue<uint64_t>()); return true;

	case LogicalTypeId::HUGEINT: {
		// Always quoted-cast: 128-bit literals don't have a bare form.
		hugeint_t h = val.GetValue<hugeint_t>();
		out = "'" + h.ToString() + "'::HUGEINT";
		return true;
	}
	case LogicalTypeId::UHUGEINT: {
		uhugeint_t h = val.GetValue<uhugeint_t>();
		out = "'" + h.ToString() + "'::UHUGEINT";
		return true;
	}

	case LogicalTypeId::FLOAT: {
		float f = val.GetValue<float>();
		if (std::isnan(f))      { out = "'nan'::FLOAT";  return true; }
		if (std::isinf(f))      { out = (f > 0 ? "'inf'::FLOAT" : "'-inf'::FLOAT"); return true; }
		char buf[32];
		std::snprintf(buf, sizeof(buf), "%.9g", f);
		out = string(buf) + "::FLOAT";
		return true;
	}
	case LogicalTypeId::DOUBLE: {
		double d = val.GetValue<double>();
		if (std::isnan(d))      { out = "'nan'::DOUBLE";  return true; }
		if (std::isinf(d))      { out = (d > 0 ? "'inf'::DOUBLE" : "'-inf'::DOUBLE"); return true; }
		char buf[40];
		std::snprintf(buf, sizeof(buf), "%.17g", d);
		out = string(buf) + "::DOUBLE";
		return true;
	}

	case LogicalTypeId::DECIMAL: {
		// DECIMAL(p,s) — always include precision/scale. Lean on
		// Value::ToString which formats the unscaled int with the right
		// decimal point, then wrap with explicit cast.
		uint8_t p = DecimalType::GetWidth(target);
		uint8_t s = DecimalType::GetScale(target);
		string lit = val.ToString();
		out = "'" + lit + "'::DECIMAL(" + std::to_string(p) + "," + std::to_string(s) + ")";
		return true;
	}

	case LogicalTypeId::VARCHAR: {
		const string s = val.GetValue<string>();
		// VARCHAR can technically carry embedded NULs in DuckDB, but they
		// don't survive a round trip through HTTP-as-text and tooling
		// truncates strings at the first NUL. Refuse rather than mutate
		// silently — the caller gets a clear NotImplementedException.
		if (s.find('\0') != string::npos) {
			return false;
		}
		out = EscapeSqlSingleQuoted(s);
		return true;
	}

	case LogicalTypeId::DATE: {
		// Value::ToString for DATE is YYYY-MM-DD already.
		out = "DATE " + EscapeSqlSingleQuoted(val.ToString());
		return true;
	}
	case LogicalTypeId::TIME:
		out = "TIME " + EscapeSqlSingleQuoted(val.ToString());
		return true;
	case LogicalTypeId::TIME_NS:
		out = "TIME_NS " + EscapeSqlSingleQuoted(val.ToString());
		return true;
	case LogicalTypeId::TIME_TZ:
		out = "TIMETZ " + EscapeSqlSingleQuoted(val.ToString());
		return true;
	case LogicalTypeId::TIMESTAMP:
		out = "TIMESTAMP " + EscapeSqlSingleQuoted(val.ToString());
		return true;
	case LogicalTypeId::TIMESTAMP_SEC:
		out = "TIMESTAMP_S " + EscapeSqlSingleQuoted(val.ToString());
		return true;
	case LogicalTypeId::TIMESTAMP_MS:
		out = "TIMESTAMP_MS " + EscapeSqlSingleQuoted(val.ToString());
		return true;
	case LogicalTypeId::TIMESTAMP_NS:
		out = "TIMESTAMP_NS " + EscapeSqlSingleQuoted(val.ToString());
		return true;
	case LogicalTypeId::TIMESTAMP_TZ:
		out = "TIMESTAMPTZ " + EscapeSqlSingleQuoted(val.ToString());
		return true;

	case LogicalTypeId::INTERVAL: {
		// Preserve all three components — months/days/microseconds.
		// The default Value::ToString stringifies to a parseable form
		// like "2 years 3 months 5 days 06:07:08.123456" but to keep
		// it explicit we build our own.
		interval_t iv = val.GetValue<interval_t>();
		std::ostringstream os;
		os << iv.months << " months "
		   << iv.days   << " days "
		   << iv.micros << " microseconds";
		out = "INTERVAL " + EscapeSqlSingleQuoted(os.str());
		return true;
	}

	case LogicalTypeId::UUID: {
		out = "'" + BaseUUID::ToString(val.GetValue<hugeint_t>()) + "'::UUID";
		return true;
	}

	case LogicalTypeId::BLOB:
	case LogicalTypeId::BIT:
	case LogicalTypeId::ENUM:
	case LogicalTypeId::LIST:
	case LogicalTypeId::STRUCT:
	case LogicalTypeId::MAP:
	case LogicalTypeId::ARRAY:
	case LogicalTypeId::UNION:
		// Catalog already exposes these as VARCHAR for reads; INSERTs
		// targeting native nested/binary types haven't been round-trip
		// tested and we won't claim support until they have. Caller
		// gets a clear NotImplementedException.
		return false;

	default:
		return false;
	}
}

// Map ExpressionType to its SQL comparison operator. Returns nullptr for
// anything outside our whitelist.
static const char *ComparisonOp(ExpressionType t) {
	switch (t) {
	case ExpressionType::COMPARE_EQUAL:                return "=";
	case ExpressionType::COMPARE_NOTEQUAL:             return "<>";
	case ExpressionType::COMPARE_LESSTHAN:             return "<";
	case ExpressionType::COMPARE_LESSTHANOREQUALTO:    return "<=";
	case ExpressionType::COMPARE_GREATERTHAN:          return ">";
	case ExpressionType::COMPARE_GREATERTHANOREQUALTO: return ">=";
	default:                                            return nullptr;
	}
}

// Resolve a BoundColumnRefExpression's ColumnBinding into a remote-table
// column index (position in bd.all_column_names). The BoundColumnRef's
// binding.column_index is a LogicalGet-level projection index, not a
// table-level one, so we must consult `get` to get the real mapping.
// Returns UINT64_MAX on any failure (binding not found, out of range, etc.).
static idx_t ResolveColumnIndex(const LogicalGet &get,
                                 const BoundColumnRefExpression &col_ref,
                                 const RipScanBindData &bd) {
	if (col_ref.binding.table_index != get.table_index) return static_cast<idx_t>(-1);
	const auto &cidx = ripdb_compat::GetColumnIndex(get, col_ref.binding);
	idx_t primary = cidx.GetPrimaryIndex();
	if (primary >= bd.all_column_names.size()) return static_cast<idx_t>(-1);
	return primary;
}

// Walk an Expression tree and translate it to a remote SQL fragment.
// Returns true if the WHOLE subtree translates; false means this subtree
// (and anything containing it) must be applied locally.
static bool TryTranslateExpression(const Expression &expr,
                                   const LogicalGet &get,
                                   const RipScanBindData &bd, string &out) {
	switch (expr.GetExpressionClass()) {
	case ExpressionClass::BOUND_COMPARISON: {
		auto &cmp = expr.Cast<BoundComparisonExpression>();
		const char *op = ComparisonOp(cmp.GetExpressionType());
		if (!op) return false;
		const BoundColumnRefExpression *col_ref = nullptr;
		const BoundConstantExpression  *lit     = nullptr;
		bool swapped = false;
		if (cmp.left->GetExpressionClass() == ExpressionClass::BOUND_COLUMN_REF &&
		    cmp.right->GetExpressionClass() == ExpressionClass::BOUND_CONSTANT) {
			col_ref = &cmp.left->Cast<BoundColumnRefExpression>();
			lit     = &cmp.right->Cast<BoundConstantExpression>();
		} else if (cmp.left->GetExpressionClass() == ExpressionClass::BOUND_CONSTANT &&
		           cmp.right->GetExpressionClass() == ExpressionClass::BOUND_COLUMN_REF) {
			col_ref = &cmp.right->Cast<BoundColumnRefExpression>();
			lit     = &cmp.left->Cast<BoundConstantExpression>();
			swapped = true;
		} else {
			return false;
		}
		idx_t cidx = ResolveColumnIndex(get, *col_ref, bd);
		if (cidx == static_cast<idx_t>(-1)) return false;
		if (!IsSafePushdownType(bd.all_column_types[cidx])) return false;
		if (lit->value.type().id() != bd.all_column_types[cidx].id()) return false;
		string lit_sql;
		if (!FormatLiteralSQL(lit->value, lit_sql)) return false;
		string col_sql = QuoteIdentifier(bd.all_column_names[cidx]);
		const char *emit_op = op;
		if (swapped) {
			switch (cmp.GetExpressionType()) {
			case ExpressionType::COMPARE_LESSTHAN:             emit_op = ">";  break;
			case ExpressionType::COMPARE_LESSTHANOREQUALTO:    emit_op = ">="; break;
			case ExpressionType::COMPARE_GREATERTHAN:          emit_op = "<";  break;
			case ExpressionType::COMPARE_GREATERTHANOREQUALTO: emit_op = "<="; break;
			default: break;
			}
		}
		out = "(" + col_sql + " " + emit_op + " " + lit_sql + ")";
		return true;
	}
	case ExpressionClass::BOUND_OPERATOR: {
		auto &op = expr.Cast<BoundOperatorExpression>();
		auto et = op.GetExpressionType();
		if ((et != ExpressionType::OPERATOR_IS_NULL &&
		     et != ExpressionType::OPERATOR_IS_NOT_NULL) || op.children.size() != 1) {
			return false;
		}
		if (op.children[0]->GetExpressionClass() != ExpressionClass::BOUND_COLUMN_REF) {
			return false;
		}
		auto &col_ref = op.children[0]->Cast<BoundColumnRefExpression>();
		idx_t cidx = ResolveColumnIndex(get, col_ref, bd);
		if (cidx == static_cast<idx_t>(-1)) return false;
		// NULL-tests are safe for any column type — the type only
		// affects value comparison, not presence.
		string col_sql = QuoteIdentifier(bd.all_column_names[cidx]);
		out = "(" + col_sql + (et == ExpressionType::OPERATOR_IS_NULL ? " IS NULL)" : " IS NOT NULL)");
		return true;
	}
	case ExpressionClass::BOUND_CONJUNCTION: {
		auto &conj = expr.Cast<BoundConjunctionExpression>();
		if (conj.GetExpressionType() != ExpressionType::CONJUNCTION_AND) return false;
		if (conj.children.empty()) return false;
		string combined;
		combined.reserve(64);
		combined.push_back('(');
		for (idx_t i = 0; i < conj.children.size(); ++i) {
			string child_sql;
			if (!TryTranslateExpression(*conj.children[i], get, bd, child_sql)) return false;
			if (i) combined.append(" AND ");
			combined.append(child_sql);
		}
		combined.push_back(')');
		out = std::move(combined);
		return true;
	}
	default:
		return false;
	}
}

static void RipPushdownFilter(ClientContext & /*context*/, LogicalGet &get,
                               FunctionData *bind_data,
                               vector<unique_ptr<Expression>> &filters) {
	if (!bind_data) return;
	auto &bd = bind_data->Cast<RipScanBindData>();

	// Walk in-place; consume (remove) any top-level filter we can
	// fully translate. Anything left behind stays in DuckDB's plan
	// and is applied locally after the scan — this is the correctness
	// guarantee of the `pushdown_complex_filter` contract.
	auto it = filters.begin();
	while (it != filters.end()) {
		string sql;
		if (TryTranslateExpression(**it, get, bd, sql)) {
			bd.pushed_wheres.push_back(std::move(sql));
			it = filters.erase(it);
		} else {
			++it;
		}
	}
}

static TableFunction MakeRipScanFunction() {
	TableFunction fn("ripdb_scan", {}, RipScanFunction, RipScanBind, RipScanInitGlobal);
	fn.projection_pushdown     = true;
	fn.filter_pushdown         = false;  // partial pushdown via complex-filter callback
	fn.filter_prune            = false;
	fn.pushdown_complex_filter = RipPushdownFilter;
	fn.get_bind_info           = RipScanGetBindInfo;
	return fn;
}

// ===========================================================================
// DML helpers (M3) — Plan{Insert,Update,Delete} dispatch and physical operators.
//
// Architecture (mirrors packages/db/CLI.md §"Native DML"):
//
//   Path 1 — source-AST passthrough (preferred). Reparse the user's original
//   SQL (one statement only), walk the bound LogicalOperator subtree to
//   confirm every catalog reference is THIS ripdb catalog, structurally
//   rewrite the parsed AST to drop the local catalog qualifier from any
//   BaseTableRef whose catalog matches us, then forward the rewritten SQL
//   to POST /ddb/exec.
//
//   Path 2 — INSERT-only sink fallback. When Path 1 rejects an INSERT (the
//   common case being `INSERT INTO r.t SELECT ... FROM local_t`), we accept
//   the child plan as a normal DuckDB Sink+Source operator. Sink() buffers
//   chunks under a row+byte cap; Finalize() emits one big multi-row
//   INSERT INTO ... VALUES (...) statement built with FormatLiteralForDML
//   and POSTs it to /ddb/exec atomically.
//
// UPDATE/DELETE have no fallback: if Path 1 can't handle them, we throw
// NotImplementedException with workaround guidance.
// ===========================================================================

// Forward decl — `IsSafeAsciiIdentifier` is defined further down (near
// `PopulateSchema`, where it's also used) but called by `EnforceDmlPreflight`
// which appears earlier.
static bool IsSafeAsciiIdentifier(const string &name);

// Parse the user's original SQL (from ClientContext::GetCurrentQuery()) and
// return exactly one statement of the requested type. Returns nullptr if the
// query parses to a different number of statements or to a different type —
// callers fall back to throwing or to the sink-fallback path as appropriate.
//
// Why we require exactly-one statement: PlanInsert/Update/Delete may be invoked
// once per statement during planning, but we have no reliable way (in v1.5.2)
// to know which statement index this Plan* call corresponds to within a
// multi-statement batch. Forwarding the full original text per statement would
// run all of it N times; slicing by stmt_location requires correlating the
// Plan* invocation to a statement, which we can't do safely. Reject and let
// the user split the batch.
template <class StmtT>
static unique_ptr<StmtT> TryParseSingleStatement(const string &sql) {
	try {
		Parser p;
		p.ParseQuery(sql);
		if (p.statements.size() != 1) return nullptr;
		auto &stmt = p.statements[0];
		if (stmt->type != StmtT::TYPE) return nullptr;
		// Move-cast: the parser owns the unique_ptr<SQLStatement>; we need
		// a unique_ptr<StmtT>. Verify the cast then transfer ownership.
		auto *raw = dynamic_cast<StmtT *>(stmt.get());
		if (!raw) return nullptr;
		(void)stmt.release();
		return unique_ptr<StmtT>(raw);
	} catch (...) {
		return nullptr;
	}
}

// Forward declarations for the rewriter family.
static void StripCatalogFromTableRefTree(TableRef &ref, const string &our_catalog_name);
static void StripCatalogFromQueryNode(class QueryNode &node, const string &our_catalog_name);
static void StripCatalogFromSelectStatement(SelectStatement &sel, const string &our_catalog_name);
static void StripCatalogFromExpression(ParsedExpression &expr, const string &our_catalog_name);

// Strip the local catalog qualifier from a single TableRef and recurse into
// its nested table refs (joins, subqueries).
//
// The DuckDB parser collapses qualified names into (catalog, schema, table)
// based on the number of parts in the source SQL:
//   `tbl`            -> catalog="" schema="" table="tbl"
//   `sch.tbl`        -> catalog="" schema="sch" table="tbl"     (NB: 'r.t')
//   `cat.sch.tbl`    -> catalog="cat" schema="sch" table="tbl"
//
// So `r.smoke_orders` (the most common form when `USE r;` was NOT done)
// arrives with our catalog name in the **schema** field, not the catalog
// field. We have to rewrite both. After the rewrite, `r.smoke_orders`
// becomes a bare `smoke_orders` — which the remote DuckDB resolves under
// its current schema (also "main"), and `r.main.smoke_orders` becomes
// `main.smoke_orders` which the remote resolves directly.
static void StripCatalogFromBaseTableRef(BaseTableRef &base, const string &our_catalog_name) {
	bool stripped = false;
	if (StringUtil::CIEquals(base.catalog_name, our_catalog_name)) {
		base.catalog_name = "";
		stripped = true;
	}
	// 2-part-name case: `r.smoke_orders` parses as schema='r'.
	if (StringUtil::CIEquals(base.schema_name, our_catalog_name)) {
		base.schema_name = "";
		stripped = true;
	}
	// If we stripped our local-attach catalog name from this ref, the
	// user demonstrably meant our catalog (whichever ripdb attachment is
	// running this Plan*). Inject `main` so the rewritten ref is fully
	// qualified — both for clarity in the forwarded SQL AND so the
	// passthrough-strict validator (which refuses unqualified source-
	// position refs to defend against multi-ripdb-USE-attack) accepts
	// it. Refs the user already wrote unqualified (`SELECT * FROM t`
	// after `USE r`) are NOT canonicalized: those are the ambiguous
	// case the strict validator rejects on purpose.
	if (stripped && base.schema_name.empty()) {
		base.schema_name = "main";
	}
}

static void StripCatalogFromTableRefTree(TableRef &ref, const string &our_catalog_name) {
	switch (ref.type) {
	case TableReferenceType::BASE_TABLE:
		StripCatalogFromBaseTableRef(ref.Cast<BaseTableRef>(), our_catalog_name);
		break;
	case TableReferenceType::JOIN: {
		auto &j = ref.Cast<JoinRef>();
		if (j.left)  StripCatalogFromTableRefTree(*j.left,  our_catalog_name);
		if (j.right) StripCatalogFromTableRefTree(*j.right, our_catalog_name);
		break;
	}
	case TableReferenceType::SUBQUERY: {
		auto &sub = ref.Cast<SubqueryRef>();
		if (sub.subquery) StripCatalogFromSelectStatement(*sub.subquery, our_catalog_name);
		break;
	}
	case TableReferenceType::EXPRESSION_LIST: {
		// VALUES rows can contain scalar subqueries whose inner SelectStatement
		// has BaseTableRefs that need the catalog qualifier stripped. Walk
		// through StripCatalogFromExpression so subquery refs inside VALUES
		// get canonicalized to `main.<table>` just like everywhere else.
		auto &els = ref.Cast<ExpressionListRef>();
		for (auto &row : els.values) {
			for (auto &expr : row) {
				if (expr) StripCatalogFromExpression(*expr, our_catalog_name);
			}
		}
		break;
	}
	default:
		// Other TableRef kinds (table-function refs, dummy, pivot, etc.)
		// don't carry catalog qualifiers we can rewrite. Leave them as-is
		// — the bound-plan dependency walk and the safety walker reject
		// them downstream.
		break;
	}
}

// Visit every ParsedExpression on a QueryNode's result modifiers
// (ORDER BY, LIMIT/OFFSET, DISTINCT ON, LIMIT %). The base QueryNode
// stores them as a uniform `vector<unique_ptr<ResultModifier>>`; each
// subclass holds its own expression members.
static void ForEachModifierExpression(QueryNode &node,
                                       const std::function<void(ParsedExpression &)> &visit) {
	for (auto &mod : node.modifiers) {
		if (!mod) continue;
		switch (mod->type) {
		case ResultModifierType::ORDER_MODIFIER: {
			auto &om = mod->Cast<OrderModifier>();
			for (auto &order : om.orders) {
				if (order.expression) visit(*order.expression);
			}
			break;
		}
		case ResultModifierType::LIMIT_MODIFIER: {
			auto &lm = mod->Cast<LimitModifier>();
			if (lm.limit)  visit(*lm.limit);
			if (lm.offset) visit(*lm.offset);
			break;
		}
		case ResultModifierType::LIMIT_PERCENT_MODIFIER: {
			auto &lp = mod->Cast<LimitPercentModifier>();
			if (lp.limit)  visit(*lp.limit);
			if (lp.offset) visit(*lp.offset);
			break;
		}
		case ResultModifierType::DISTINCT_MODIFIER: {
			auto &dm = mod->Cast<DistinctModifier>();
			for (auto &expr : dm.distinct_on_targets) {
				if (expr) visit(*expr);
			}
			break;
		}
		}
	}
}

// Const variant for the validator path.
static void ForEachModifierExpression(const QueryNode &node,
                                       const std::function<void(const ParsedExpression &)> &visit) {
	for (const auto &mod : node.modifiers) {
		if (!mod) continue;
		switch (mod->type) {
		case ResultModifierType::ORDER_MODIFIER: {
			const auto &om = mod->Cast<OrderModifier>();
			for (const auto &order : om.orders) {
				if (order.expression) visit(*order.expression);
			}
			break;
		}
		case ResultModifierType::LIMIT_MODIFIER: {
			const auto &lm = mod->Cast<LimitModifier>();
			if (lm.limit)  visit(*lm.limit);
			if (lm.offset) visit(*lm.offset);
			break;
		}
		case ResultModifierType::LIMIT_PERCENT_MODIFIER: {
			const auto &lp = mod->Cast<LimitPercentModifier>();
			if (lp.limit)  visit(*lp.limit);
			if (lp.offset) visit(*lp.offset);
			break;
		}
		case ResultModifierType::DISTINCT_MODIFIER: {
			const auto &dm = mod->Cast<DistinctModifier>();
			for (const auto &expr : dm.distinct_on_targets) {
				if (expr) visit(*expr);
			}
			break;
		}
		}
	}
}

static void StripCatalogFromQueryNode(QueryNode &node, const string &our_catalog_name) {
	switch (node.type) {
	case QueryNodeType::SELECT_NODE: {
		auto &sn = node.Cast<SelectNode>();
		if (sn.from_table) StripCatalogFromTableRefTree(*sn.from_table, our_catalog_name);
		// Walk every parsed expression for nested SubqueryExpressions —
		// any of these can contain a BaseTableRef with the local catalog
		// qualifier still attached.
		for (auto &expr : sn.select_list) {
			if (expr) StripCatalogFromExpression(*expr, our_catalog_name);
		}
		if (sn.where_clause) StripCatalogFromExpression(*sn.where_clause, our_catalog_name);
		for (auto &expr : sn.groups.group_expressions) {
			if (expr) StripCatalogFromExpression(*expr, our_catalog_name);
		}
		if (sn.having)  StripCatalogFromExpression(*sn.having,  our_catalog_name);
		if (sn.qualify) StripCatalogFromExpression(*sn.qualify, our_catalog_name);
		// Result modifiers (ORDER BY, LIMIT, OFFSET, DISTINCT ON) — every
		// expression here can host the same qualified-ident / scalar-
		// subquery shapes the validator cares about.
		ForEachModifierExpression(node, [&](ParsedExpression &expr) {
			StripCatalogFromExpression(expr, our_catalog_name);
		});
		// CTEs in cte_map could host nested TableRefs — handle the simple
		// case where each CTE is itself a SelectStatement.
		for (auto &cte : sn.cte_map.map) {
			if (cte.second && cte.second->query) {
				StripCatalogFromSelectStatement(*cte.second->query, our_catalog_name);
			}
		}
		break;
	}
	case QueryNodeType::SET_OPERATION_NODE: {
		auto &sop = node.Cast<SetOperationNode>();
		// v1.5.2 stores set-op operands in a children vector (the older
		// left/right fields were collapsed). Walk all of them.
		for (auto &child : sop.children) {
			if (child) StripCatalogFromQueryNode(*child, our_catalog_name);
		}
		// SET-OP nodes can also carry their own ORDER BY/LIMIT/etc. modifiers.
		ForEachModifierExpression(node, [&](ParsedExpression &expr) {
			StripCatalogFromExpression(expr, our_catalog_name);
		});
		break;
	}
	case QueryNodeType::CTE_NODE: {
		auto &cte = node.Cast<CTENode>();
		// CTENode is the legacy (deprecated) CTE form; both `query` and
		// `child` here are `unique_ptr<QueryNode>` (not SelectStatement).
		if (cte.query) StripCatalogFromQueryNode(*cte.query, our_catalog_name);
		if (cte.child) StripCatalogFromQueryNode(*cte.child, our_catalog_name);
		break;
	}
	case QueryNodeType::RECURSIVE_CTE_NODE: {
		// RecursiveCTENode also uses children rather than left/right in v1.5.2.
		// Use the generic ParsedExpressionIterator route to avoid hard-coding
		// internal field names that may change across versions.
		// (Walk via the modifier callback no-op and the table-ref callback.)
		// Conservative: skip — if a recursive CTE is involved, the
		// dependency walk on the bound plan already accepted only ripdb
		// LogicalGets, so the remote will resolve them as-is.
		break;
	}
	default:
		// BoundQueryNode shouldn't appear here (we only walk parsed
		// statements); if a new QueryNode subclass shows up we leave
		// it alone — worst case, the remote-side bind throws clearly.
		break;
	}
}

static void StripCatalogFromSelectStatement(SelectStatement &sel, const string &our_catalog_name) {
	if (sel.node) StripCatalogFromQueryNode(*sel.node, our_catalog_name);
}

// Walk a parsed expression and rewrite any nested SubqueryExpression's
// inner SelectStatement (which can contain BaseTableRefs that need their
// catalog qualifier stripped). The validator runs after rewrite, so this
// has to happen FIRST or qualified subquery refs would either trip the
// validator or miscompile to the remote.
static void StripCatalogFromExpression(ParsedExpression &expr, const string &our_catalog_name) {
	if (expr.GetExpressionClass() == ExpressionClass::SUBQUERY) {
		auto &sub = expr.Cast<SubqueryExpression>();
		if (sub.subquery) {
			StripCatalogFromSelectStatement(*sub.subquery, our_catalog_name);
		}
	}
	ParsedExpressionIterator::EnumerateChildren(
	    expr, [&](ParsedExpression &child) {
		    StripCatalogFromExpression(child, our_catalog_name);
	    });
}

// Walk a parsed SQLStatement and rewrite catalog-qualified table refs that
// point to `our_catalog_name`. Different statement subclasses hold their
// table refs in different places; we handle exactly the three we forward.
static void RewriteCatalogQualifierInStatement(SQLStatement &stmt, const string &our_catalog_name) {
	switch (stmt.type) {
	case StatementType::INSERT_STATEMENT: {
		auto &ins = stmt.Cast<InsertStatement>();
		// 3-part `cat.sch.tbl` form.
		if (StringUtil::CIEquals(ins.catalog, our_catalog_name)) {
			ins.catalog = "";
		}
		// 2-part `r.tbl` form: parser puts our catalog in the schema slot.
		if (StringUtil::CIEquals(ins.schema, our_catalog_name)) {
			ins.schema = "";
		}
		if (ins.table_ref) StripCatalogFromTableRefTree(*ins.table_ref, our_catalog_name);
		// INSERT ... SELECT — rewrite TableRefs in the source query too.
		if (ins.select_statement) StripCatalogFromSelectStatement(*ins.select_statement, our_catalog_name);
		break;
	}
	case StatementType::UPDATE_STATEMENT: {
		auto &upd = stmt.Cast<UpdateStatement>();
		if (upd.table) StripCatalogFromTableRefTree(*upd.table, our_catalog_name);
		// SET expressions and the optional UpdateSetInfo.condition can
		// contain scalar subqueries against ripdb tables; walk them too.
		if (upd.set_info) {
			for (auto &expr : upd.set_info->expressions) {
				if (expr) StripCatalogFromExpression(*expr, our_catalog_name);
			}
			if (upd.set_info->condition) {
				StripCatalogFromExpression(*upd.set_info->condition, our_catalog_name);
			}
		}
		break;
	}
	case StatementType::DELETE_STATEMENT: {
		auto &del = stmt.Cast<DeleteStatement>();
		if (del.table) StripCatalogFromTableRefTree(*del.table, our_catalog_name);
		// DELETE WHERE can contain scalar subqueries / IN(SELECT ...)
		// against ripdb tables.
		if (del.condition) StripCatalogFromExpression(*del.condition, our_catalog_name);
		break;
	}
	default:
		break;
	}
}

// ---------------------------------------------------------------------------
// ValidateRewrittenStatement — safety gate AFTER catalog-qualifier rewrite.
//
// The TableRef rewriter (StripCatalogFromTableRefTree + friends) only knows
// about FROM-clause table references. Real SQL puts qualified identifiers in
// many other places that the rewriter cannot reach without a full parsed-
// expression visitor:
//
//   DELETE FROM rip.t WHERE rip.t.id = 5         -- ColumnRefExpression in WHERE
//   UPDATE rip.t SET col = ... WHERE rip.t.x = 1 -- ColumnRefExpression in WHERE
//   UPDATE rip.t SET col = (SELECT ... FROM rip.u) WHERE ... -- nested SELECT in SET
//   DELETE FROM rip.t WHERE id IN (SELECT id FROM rip.t)     -- nested SELECT in WHERE
//
// Forwarding such SQL with the local catalog name still embedded is unsafe:
// in the best case the remote bind errors out; in the worst case the remote
// happens to have a catalog/schema/attachment with the same name and the
// statement silently mutates or reads the wrong rows.
//
// Rather than implement the full parsed-expression visitor (a big chunk of
// work that overlaps DuckDB's own ParsedExpressionIterator quirks), v1 takes
// the conservative path: walk the rewritten parsed AST and reject if ANY
// `ColumnRefExpression`'s leftmost qualifier matches our local catalog
// name. The walker also catches:
//
//   - prepared-statement parameter placeholders (`$1`, `?`, `$name`) anywhere
//     in the statement (`ParameterExpression`) — values aren't bound at this
//     stage and would forward as literal placeholders to the remote.
//   - references to the synthetic `rowid` column (any ColumnRefExpression
//     whose final-component name is "rowid"). ripdb scans synthesize rowids
//     locally; the remote DuckDB has its own physical rowid, and forwarding
//     `WHERE rowid = N` would mutate a different row.
//
// On success returns empty string (statement is safe to forward). On any
// reject returns the human-readable reason. The caller throws
// NotImplementedException with that message.
// ---------------------------------------------------------------------------

// Forward decls for the post-rewrite safety walker.
//
// `in_source_context` distinguishes BaseTableRefs in the DML's own target
// slot (the INSERT/UPDATE/DELETE's primary table, known-ours from `op.table`)
// from refs in source positions (FROM clauses, subquery FROMs, JOIN
// children) we read from rather than write to. The walker is currently
// loose either way (accepts empty or `main` schema) — the multi-ripdb-USE-
// attack defense lives entirely in `ValidateOriginalSourceProvenance`
// which runs BEFORE rewrite and requires source refs to carry our local-
// attach catalog name in catalog or schema slot.
static string ValidateParsedExpression(const ParsedExpression &expr,
                                        const string &our_catalog_name);
static string ValidateTableRefSubtree(const TableRef &ref,
                                       const string &our_catalog_name,
                                       bool in_source_context);
static string ValidateQueryNodeSubtree(const QueryNode &node,
                                        const string &our_catalog_name);
static string ValidateSelectStatementSubtree(const SelectStatement &sel,
                                              const string &our_catalog_name);

static string ValidateColumnRef(const ColumnRefExpression &cref,
                                 const string &our_catalog_name) {
	// rowid is always rejected for DML — see header comment.
	if (!cref.column_names.empty()) {
		const string &leaf = cref.column_names.back();
		if (StringUtil::CIEquals(leaf, "rowid")) {
			return "DML referencing the synthetic 'rowid' column is not supported "
			       "by ripdb (ripdb scans synthesize rowids locally; they are not "
			       "stable identifiers on the remote DuckDB). Use a real primary key.";
		}
	}
	// Catalog qualifier leaked through the rewrite — the user-emitted SQL
	// contained a qualified identifier that StripCatalogFromTableRefTree
	// couldn't reach (it only handles FROM-clause TableRefs).
	if (cref.column_names.size() >= 2 &&
	    StringUtil::CIEquals(cref.column_names.front(), our_catalog_name)) {
		return StringUtil::Format(
		    "ripdb: this DML uses qualified identifier '%s' inside an "
		    "expression (WHERE / SET / subquery), which the v1 catalog-qualifier "
		    "rewriter doesn't reach. Drop the catalog qualifier from "
		    "expression-position references — `USE %s; ...` first, or refer "
		    "to columns unqualified.",
		    cref.ToString(), our_catalog_name);
	}
	return string();
}

static string ValidateParsedExpression(const ParsedExpression &expr,
                                        const string &our_catalog_name) {
	if (expr.GetExpressionClass() == ExpressionClass::PARAMETER) {
		return "ripdb: prepared-statement parameter placeholders ($1, ?, "
		       "$name) are not supported in DML. The placeholders aren't "
		       "substituted with bound values at the planning stage, so the "
		       "remote would receive the placeholder literally. Inline the "
		       "value or use a non-prepared statement.";
	}
	if (expr.GetExpressionClass() == ExpressionClass::COLUMN_REF) {
		const auto &cref = expr.Cast<ColumnRefExpression>();
		string err = ValidateColumnRef(cref, our_catalog_name);
		if (!err.empty()) return err;
	}
	if (expr.GetExpressionClass() == ExpressionClass::SUBQUERY) {
		const auto &sub = expr.Cast<SubqueryExpression>();
		if (sub.subquery) {
			string err = ValidateSelectStatementSubtree(*sub.subquery, our_catalog_name);
			if (!err.empty()) return err;
		}
		// fall through to enumerate the IN/ANY/ALL operand expressions too
	}
	string err;
	ParsedExpressionIterator::EnumerateChildren(
	    expr, [&](const ParsedExpression &child) {
		    if (!err.empty()) return;
		    err = ValidateParsedExpression(child, our_catalog_name);
	    });
	return err;
}

// Acceptance rule for BaseTableRefs at POST-rewrite validation time.
// Catches gross leftovers (non-empty catalog, non-`main` schema). The
// multi-ripdb-USE-attack defense is enforced separately via
// `ValidateOriginalSourceProvenance` running BEFORE the rewrite.
static bool IsAcceptableBaseTableQualifier(const string &catalog, const string &schema) {
	if (!catalog.empty()) return false;
	if (schema.empty()) return true;
	return StringUtil::CIEquals(schema, "main");
}

static string ValidateTableRefSubtree(const TableRef &ref,
                                       const string &our_catalog_name,
                                       bool in_source_context) {
	switch (ref.type) {
	case TableReferenceType::BASE_TABLE: {
		const auto &base = ref.Cast<BaseTableRef>();
		if (!IsAcceptableBaseTableQualifier(base.catalog_name, base.schema_name)) {
			return StringUtil::Format(
			    "ripdb: base-table reference '%s%s%s%s%s' carries a catalog/"
			    "schema qualifier the rewriter didn't (or shouldn't) strip. "
			    "If you see this, the rewriter missed a TableRef position.",
			    base.catalog_name.empty() ? "" : base.catalog_name.c_str(),
			    base.catalog_name.empty() ? "" : ".",
			    base.schema_name.empty()  ? "" : base.schema_name.c_str(),
			    base.schema_name.empty()  ? "" : ".",
			    base.table_name.c_str());
		}
		return string();
	}
	case TableReferenceType::JOIN: {
		const auto &j = ref.Cast<JoinRef>();
		if (j.left) {
			string err = ValidateTableRefSubtree(*j.left, our_catalog_name, in_source_context);
			if (!err.empty()) return err;
		}
		if (j.right) {
			string err = ValidateTableRefSubtree(*j.right, our_catalog_name, in_source_context);
			if (!err.empty()) return err;
		}
		if (j.condition) {
			string err = ValidateParsedExpression(*j.condition, our_catalog_name);
			if (!err.empty()) return err;
		}
		return string();
	}
	case TableReferenceType::SUBQUERY: {
		const auto &sub = ref.Cast<SubqueryRef>();
		if (sub.subquery) {
			return ValidateSelectStatementSubtree(*sub.subquery, our_catalog_name);
		}
		return string();
	}
	case TableReferenceType::EXPRESSION_LIST: {
		// `INSERT INTO t VALUES (...)` parses with an ExpressionListRef.
		// The cells can contain arbitrary parsed expressions — including
		// scalar subqueries that reference ripdb tables. Walk them so we
		// catch rowid / parameter / qualified-ColumnRef issues inside.
		const auto &els = ref.Cast<ExpressionListRef>();
		for (auto &row : els.values) {
			for (auto &expr : row) {
				if (!expr) continue;
				string err = ValidateParsedExpression(*expr, our_catalog_name);
				if (!err.empty()) return err;
			}
		}
		return string();
	}
	case TableReferenceType::EMPTY_FROM:
		// `SELECT 1` (no FROM) and similar constant-only sources.
		return string();
	default:
		// TABLE_FUNCTION (range, read_csv, ...), CTE, PIVOT, SHOW_REF,
		// COLUMN_DATA, DELIM_GET — all local-data references or constructs
		// the rewriter doesn't touch. The bound-plan dependency walk
		// (`OnlyRipdbScans`) rejects most of them too, but defense in
		// depth: refuse to forward any TableRef the v1 rewriter doesn't
		// validate.
		return StringUtil::Format(
		    "ripdb: unsupported TableRef type %d in DML statement (v1 only "
		    "validates base tables, joins, subqueries, VALUES lists, and "
		    "empty-FROM; recursive CTEs / table functions / pivots etc. are "
		    "out of scope).",
		    static_cast<int>(ref.type));
	}
}

static string ValidateQueryNodeSubtree(const QueryNode &node,
                                        const string &our_catalog_name) {
	// Modifiers (ORDER BY / LIMIT / OFFSET / DISTINCT ON) live on the base
	// QueryNode, so visit them here regardless of subclass before
	// dispatching to the subclass-specific fields.
	{
		string err;
		ForEachModifierExpression(node, [&](const ParsedExpression &expr) {
			if (err.empty()) err = ValidateParsedExpression(expr, our_catalog_name);
		});
		if (!err.empty()) return err;
	}
	switch (node.type) {
	case QueryNodeType::SELECT_NODE: {
		const auto &sn = node.Cast<SelectNode>();
		for (auto &expr : sn.select_list) {
			if (!expr) continue;
			string err = ValidateParsedExpression(*expr, our_catalog_name);
			if (!err.empty()) return err;
		}
		if (sn.from_table) {
			string err = ValidateTableRefSubtree(*sn.from_table, our_catalog_name,
			                                     /*in_source_context=*/true);
			if (!err.empty()) return err;
		}
		if (sn.where_clause) {
			string err = ValidateParsedExpression(*sn.where_clause, our_catalog_name);
			if (!err.empty()) return err;
		}
		for (auto &expr : sn.groups.group_expressions) {
			if (!expr) continue;
			string err = ValidateParsedExpression(*expr, our_catalog_name);
			if (!err.empty()) return err;
		}
		if (sn.having) {
			string err = ValidateParsedExpression(*sn.having, our_catalog_name);
			if (!err.empty()) return err;
		}
		if (sn.qualify) {
			string err = ValidateParsedExpression(*sn.qualify, our_catalog_name);
			if (!err.empty()) return err;
		}
		for (auto &cte : sn.cte_map.map) {
			if (cte.second && cte.second->query) {
				string err = ValidateSelectStatementSubtree(*cte.second->query, our_catalog_name);
				if (!err.empty()) return err;
			}
		}
		return string();
	}
	case QueryNodeType::SET_OPERATION_NODE: {
		const auto &sop = node.Cast<SetOperationNode>();
		for (auto &child : sop.children) {
			if (!child) continue;
			string err = ValidateQueryNodeSubtree(*child, our_catalog_name);
			if (!err.empty()) return err;
		}
		return string();
	}
	default:
		// CTENode (deprecated), RecursiveCTENode, etc. — out of scope for v1.
		// We reject rather than forward un-validated subtrees.
		return "ripdb: this DML uses a query-node form (recursive CTE, "
		       "deprecated CTE wrapper, etc.) that the v1 safety walker "
		       "doesn't validate. Materialize via a temp table first.";
	}
}

static string ValidateSelectStatementSubtree(const SelectStatement &sel,
                                              const string &our_catalog_name) {
	if (!sel.node) return string();
	return ValidateQueryNodeSubtree(*sel.node, our_catalog_name);
}

// "Is this InsertStatement pure VALUES?" — distinguishes the passthrough-
// eligible case (`INSERT INTO t VALUES (...)` with no SELECT body) from the
// `INSERT INTO t SELECT ...` case that must use the sink fallback.
//
// `GetValuesList()` returns non-null only when the source is a literal
// VALUES expression list. INSERT...SELECT in any form (including
// `SELECT * FROM (VALUES ...)`) returns null and is routed to the sink path.
static bool IsPureInsertValues(const InsertStatement &ins) {
	return ins.GetValuesList() != nullptr;
}

// ---------------------------------------------------------------------------
// ValidateOriginalSourceProvenance — multi-ripdb USE-attack defense.
//
// Runs on the ORIGINAL parsed AST, BEFORE the catalog rewriter touches it.
// For every BaseTableRef in source position (a SELECT's FROM clause, a
// JOIN's children, a SubqueryRef's inner SELECT, a SubqueryExpression's
// inner SELECT — but NOT the DML's own target table), require the user
// to have qualified the ref with our local-attach catalog name in either
// the catalog slot (3-part `r.main.t` → catalog="r") or the schema slot
// (2-part `r.t` → schema="r"). Bare `t`, pre-existing `main.t`, `s.t`,
// `s.main.t`, etc. are all rejected.
//
// This is the only rule that's robust against:
//
//   ATTACH 'rip://server-a' AS r (TYPE ripdb);
//   ATTACH 'rip://server-b' AS s (TYPE ripdb);
//   USE s;
//   UPDATE r.smoke_orders SET amount = (SELECT max(amount) FROM main.t)
//                                                              ^^^^
// where the local binder resolves `main.t` to `s.main.t` (current catalog
// is `s`) but a verbatim forward to r's server would resolve it as
// `r.main.t`. Without proof that the user wrote `r.t` (or `r.main.t`),
// passthrough cannot safely forward the source ref.
//
// The rewriter (`StripCatalogFromBaseTableRef`) only canonicalizes refs
// that match our_catalog_name in catalog or schema; this walker enforces
// that source refs ALWAYS match before rewrite, so what reaches the
// remote is always provably ours.
// ---------------------------------------------------------------------------

static string ValidateProvenanceTableRef(const TableRef &ref,
                                          const string &our_catalog_name,
                                          bool in_source_context);
static string ValidateProvenanceQueryNode(const QueryNode &node,
                                           const string &our_catalog_name);
static string ValidateProvenanceExpression(const ParsedExpression &expr,
                                            const string &our_catalog_name);

static string ValidateProvenanceTableRef(const TableRef &ref,
                                          const string &our_catalog_name,
                                          bool in_source_context) {
	switch (ref.type) {
	case TableReferenceType::BASE_TABLE: {
		if (!in_source_context) return string();  // target ref is known-ours
		const auto &base = ref.Cast<BaseTableRef>();
		bool ours = StringUtil::CIEquals(base.catalog_name, our_catalog_name) ||
		            StringUtil::CIEquals(base.schema_name,  our_catalog_name);
		if (!ours) {
			return StringUtil::Format(
			    "ripdb: source-position table reference '%s%s%s%s%s' is not "
			    "explicitly qualified with this attachment's catalog name "
			    "('%s'). v1 passthrough requires source refs to be written "
			    "as `%s.<table>` or `%s.main.<table>` so we can prove they "
			    "weren't bound to a different ripdb attachment via `USE` "
			    "(silent cross-server mis-targeting). Qualify the ref or "
			    "materialize the source via a temp table.",
			    base.catalog_name.empty() ? "" : base.catalog_name.c_str(),
			    base.catalog_name.empty() ? "" : ".",
			    base.schema_name.empty()  ? "" : base.schema_name.c_str(),
			    base.schema_name.empty()  ? "" : ".",
			    base.table_name.c_str(),
			    our_catalog_name.c_str(),
			    our_catalog_name.c_str(),
			    our_catalog_name.c_str());
		}
		return string();
	}
	case TableReferenceType::JOIN: {
		const auto &j = ref.Cast<JoinRef>();
		if (j.left) {
			string err = ValidateProvenanceTableRef(*j.left, our_catalog_name, in_source_context);
			if (!err.empty()) return err;
		}
		if (j.right) {
			string err = ValidateProvenanceTableRef(*j.right, our_catalog_name, in_source_context);
			if (!err.empty()) return err;
		}
		if (j.condition) {
			string err = ValidateProvenanceExpression(*j.condition, our_catalog_name);
			if (!err.empty()) return err;
		}
		return string();
	}
	case TableReferenceType::SUBQUERY: {
		const auto &sub = ref.Cast<SubqueryRef>();
		if (sub.subquery && sub.subquery->node) {
			return ValidateProvenanceQueryNode(*sub.subquery->node, our_catalog_name);
		}
		return string();
	}
	case TableReferenceType::EXPRESSION_LIST: {
		// `INSERT INTO t VALUES (..., (SELECT ... FROM main.x), ...)` — the
		// VALUES list itself is a TableRef, but the per-cell expressions
		// can host scalar subqueries against ripdb tables. Walk every
		// expression in every row through the provenance check.
		const auto &els = ref.Cast<ExpressionListRef>();
		for (auto &row : els.values) {
			for (auto &expr : row) {
				if (!expr) continue;
				string err = ValidateProvenanceExpression(*expr, our_catalog_name);
				if (!err.empty()) return err;
			}
		}
		return string();
	}
	case TableReferenceType::EMPTY_FROM:
		return string();
	default:
		// Unsupported TableRef forms — the post-rewrite validator catches
		// these too with a more detailed message; here just return clean.
		return string();
	}
}

static string ValidateProvenanceExpression(const ParsedExpression &expr,
                                            const string &our_catalog_name) {
	if (expr.GetExpressionClass() == ExpressionClass::SUBQUERY) {
		const auto &sub = expr.Cast<SubqueryExpression>();
		if (sub.subquery && sub.subquery->node) {
			string err = ValidateProvenanceQueryNode(*sub.subquery->node, our_catalog_name);
			if (!err.empty()) return err;
		}
	}
	string err;
	ParsedExpressionIterator::EnumerateChildren(
	    expr, [&](const ParsedExpression &child) {
		    if (!err.empty()) return;
		    err = ValidateProvenanceExpression(child, our_catalog_name);
	    });
	return err;
}

static string ValidateProvenanceQueryNode(const QueryNode &node,
                                           const string &our_catalog_name) {
	// Walk modifiers (ORDER BY etc.) — they can host subqueries with their
	// own source refs.
	{
		string err;
		ForEachModifierExpression(node, [&](const ParsedExpression &expr) {
			if (err.empty()) err = ValidateProvenanceExpression(expr, our_catalog_name);
		});
		if (!err.empty()) return err;
	}
	switch (node.type) {
	case QueryNodeType::SELECT_NODE: {
		const auto &sn = node.Cast<SelectNode>();
		if (sn.from_table) {
			string err = ValidateProvenanceTableRef(*sn.from_table, our_catalog_name,
			                                         /*in_source_context=*/true);
			if (!err.empty()) return err;
		}
		for (auto &expr : sn.select_list) {
			if (!expr) continue;
			string err = ValidateProvenanceExpression(*expr, our_catalog_name);
			if (!err.empty()) return err;
		}
		if (sn.where_clause) {
			string err = ValidateProvenanceExpression(*sn.where_clause, our_catalog_name);
			if (!err.empty()) return err;
		}
		for (auto &expr : sn.groups.group_expressions) {
			if (!expr) continue;
			string err = ValidateProvenanceExpression(*expr, our_catalog_name);
			if (!err.empty()) return err;
		}
		if (sn.having) {
			string err = ValidateProvenanceExpression(*sn.having, our_catalog_name);
			if (!err.empty()) return err;
		}
		if (sn.qualify) {
			string err = ValidateProvenanceExpression(*sn.qualify, our_catalog_name);
			if (!err.empty()) return err;
		}
		for (auto &cte : sn.cte_map.map) {
			if (cte.second && cte.second->query && cte.second->query->node) {
				string err = ValidateProvenanceQueryNode(*cte.second->query->node, our_catalog_name);
				if (!err.empty()) return err;
			}
		}
		return string();
	}
	case QueryNodeType::SET_OPERATION_NODE: {
		const auto &sop = node.Cast<SetOperationNode>();
		for (auto &child : sop.children) {
			if (!child) continue;
			string err = ValidateProvenanceQueryNode(*child, our_catalog_name);
			if (!err.empty()) return err;
		}
		return string();
	}
	default:
		return string();
	}
}

// Top-level: walk the original parsed DML statement and enforce that all
// source-position BaseTableRefs are explicitly qualified with our catalog.
static string ValidateOriginalSourceProvenance(const SQLStatement &stmt,
                                                const string &our_catalog_name) {
	switch (stmt.type) {
	case StatementType::INSERT_STATEMENT: {
		const auto &ins = stmt.Cast<InsertStatement>();
		if (ins.select_statement && ins.select_statement->node) {
			return ValidateProvenanceQueryNode(*ins.select_statement->node, our_catalog_name);
		}
		return string();
	}
	case StatementType::UPDATE_STATEMENT: {
		const auto &upd = stmt.Cast<UpdateStatement>();
		// upd.table is target — skip. upd.set_info.expressions/condition
		// can host subquery sources.
		if (upd.set_info) {
			for (auto &expr : upd.set_info->expressions) {
				if (!expr) continue;
				string err = ValidateProvenanceExpression(*expr, our_catalog_name);
				if (!err.empty()) return err;
			}
			if (upd.set_info->condition) {
				string err = ValidateProvenanceExpression(*upd.set_info->condition, our_catalog_name);
				if (!err.empty()) return err;
			}
		}
		return string();
	}
	case StatementType::DELETE_STATEMENT: {
		const auto &del = stmt.Cast<DeleteStatement>();
		if (del.condition) {
			return ValidateProvenanceExpression(*del.condition, our_catalog_name);
		}
		return string();
	}
	default:
		return string();
	}
}

// Top-level entry point. Returns empty string if the rewritten DML is safe
// to forward; otherwise the human-readable reject reason.
//
// Catches: rowid in DML, parameter placeholders, qualified-ColumnRef leaks
// (`r.t.col` in a WHERE/SET/subquery), unsupported TableRef forms, and
// unsupported QueryNode forms. The multi-ripdb-USE-attack defense lives in
// `ValidateOriginalSourceProvenance` (pre-rewrite), not here.
static string ValidateRewrittenStatement(const SQLStatement &stmt,
                                          const string &our_catalog_name) {
	switch (stmt.type) {
	case StatementType::INSERT_STATEMENT: {
		const auto &ins = stmt.Cast<InsertStatement>();
		// The post-rewrite InsertStatement.{catalog,schema,table} carry the
		// target identifier already canonicalized; no need to revisit.
		if (ins.select_statement) {
			string err = ValidateSelectStatementSubtree(*ins.select_statement, our_catalog_name);
			if (!err.empty()) return err;
		}
		return string();
	}
	case StatementType::UPDATE_STATEMENT: {
		const auto &upd = stmt.Cast<UpdateStatement>();
		if (upd.table) {
			string err = ValidateTableRefSubtree(*upd.table, our_catalog_name,
			                                     /*in_source_context=*/false);
			if (!err.empty()) return err;
		}
		if (upd.set_info) {
			for (auto &expr : upd.set_info->expressions) {
				if (!expr) continue;
				string err = ValidateParsedExpression(*expr, our_catalog_name);
				if (!err.empty()) return err;
			}
			if (upd.set_info->condition) {
				string err = ValidateParsedExpression(*upd.set_info->condition, our_catalog_name);
				if (!err.empty()) return err;
			}
		}
		return string();
	}
	case StatementType::DELETE_STATEMENT: {
		const auto &del = stmt.Cast<DeleteStatement>();
		if (del.table) {
			string err = ValidateTableRefSubtree(*del.table, our_catalog_name,
			                                     /*in_source_context=*/false);
			if (!err.empty()) return err;
		}
		if (del.condition) {
			string err = ValidateParsedExpression(*del.condition, our_catalog_name);
			if (!err.empty()) return err;
		}
		return string();
	}
	default:
		return string();
	}
}

// Reject-list helpers — return non-empty error string if the statement falls
// outside the v1 supported subset; empty string means OK to forward.
static string RejectInsertStatement(const InsertStatement &s) {
	if (!s.returning_list.empty()) {
		return "RETURNING is not supported by ripdb in v1 (would require "
		       "row-shaped response handling). Run the statement directly via "
		       "the rip-db UI or a RETURNING-aware client for now.";
	}
	if (s.on_conflict_info && s.on_conflict_info->action_type != OnConflictAction::THROW) {
		return "INSERT ... ON CONFLICT (UPSERT) is not supported by ripdb in v1.";
	}
	if (s.default_values) {
		return "INSERT ... DEFAULT VALUES is not yet supported by ripdb in v1.";
	}
	return string();
}
static string RejectUpdateStatement(const UpdateStatement &s) {
	if (!s.returning_list.empty()) {
		return "UPDATE ... RETURNING is not supported by ripdb in v1.";
	}
	if (s.from_table) {
		return "UPDATE ... FROM is not supported by ripdb in v1 (introduces extra "
		       "source tables and name-resolution complexity). Materialize the "
		       "join in a temp table first.";
	}
	return string();
}
static string RejectDeleteStatement(const DeleteStatement &s) {
	if (!s.returning_list.empty()) {
		return "DELETE ... RETURNING is not supported by ripdb in v1.";
	}
	if (!s.using_clauses.empty()) {
		return "DELETE ... USING is not supported by ripdb in v1.";
	}
	return string();
}

// Walk a bound LogicalOperator (recursively, including bound subquery
// subplans via ExpressionIterator) and confirm every LogicalGet uses the
// `ripdb_scan` table function. Returns true iff every catalog-backed scan
// in the subtree is ripdb-backed.
//
// IMPORTANT: this does NOT prove the scans belong to OUR specific RipCatalog
// attachment. Identification is by `function.name == "ripdb_scan"` (the only
// stable identifier we have at this stage; see implementation note below).
// With multiple ripdb attachments, this check accepts `s.u` as easily as
// `r.t`. The cross-attachment silent-mis-target risk is mitigated by the
// AST safety walker's BASE_TABLE check — `ValidateTableRefSubtree` refuses
// any rewritten BaseTableRef whose `(catalog,schema)` qualifier wasn't
// stripped to our `main` schema. So a dangling `s.u` from a different
// ripdb attachment would survive this dependency check but get rejected by
// the safety walker that runs immediately afterwards.
//
// Implementation note: we identify by function name because the default
// DuckDB dispatch for Catalog::Plan{Update,Delete,Insert} physical-plans
// `op.children[0]` BEFORE invoking our override (see plan_update.cpp /
// plan_insert.cpp in the DuckDB source). Physical planning moves the
// LogicalGet's `bind_data` into the PhysicalTableScan, leaving the
// LogicalGet shell with a null bind_data — so `LogicalGet::GetTable()`
// returns nullptr by the time we walk. The TableFunction's `name` field
// is copied (not moved) into PhysicalTableScan, so it remains intact and
// is the only stable identifier available here.
//
// Catches: LogicalGets inside subquery expressions via ExpressionIterator
// (BoundSubqueryExpression carries a bound LogicalOperator subplan).
// Does NOT walk: replacement scans, recursive CTE roots, or future
// LogicalOperator subclasses that host a scan in non-standard locations.
// Those are covered by the parsed-AST safety walker as a second gate.
static bool OnlyRipdbScans(const LogicalOperator &op);

static bool ExpressionOnlyRipdbScans(const Expression &expr) {
	bool ok = true;
	if (expr.GetExpressionClass() == ExpressionClass::BOUND_SUBQUERY) {
		auto &sub = expr.Cast<BoundSubqueryExpression>();
		if (sub.subquery.plan && !OnlyRipdbScans(*sub.subquery.plan)) {
			return false;
		}
	}
	ExpressionIterator::EnumerateChildren(expr, [&](const Expression &child) {
		if (!ok) return;
		if (!ExpressionOnlyRipdbScans(child)) ok = false;
	});
	return ok;
}

static bool OnlyRipdbScans(const LogicalOperator &op) {
	if (op.type == LogicalOperatorType::LOGICAL_GET) {
		const auto &get = op.Cast<LogicalGet>();
		if (get.function.name != "ripdb_scan") {
			return false;
		}
	}
	// Recurse into expressions (including any bound subquery subplans).
	for (const auto &expr : op.expressions) {
		if (expr && !ExpressionOnlyRipdbScans(*expr)) return false;
	}
	// Recurse into operator children.
	for (const auto &child : op.children) {
		if (child && !OnlyRipdbScans(*child)) return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// RipTableEntry. Stable per-attach instance (owned by RipSchemaEntry::tables_).
// ---------------------------------------------------------------------------

class RipTableEntry : public TableCatalogEntry {
public:
	RipTableEntry(Catalog &catalog, SchemaCatalogEntry &schema, CreateTableInfo &info, string remote_name)
	    : TableCatalogEntry(catalog, schema, info), remote_name_(std::move(remote_name)) {
	}

	const string &RemoteName() const { return remote_name_; }

	// Mark a column as "exposed-as-VARCHAR-but-remote-is-native". The DML
	// write path consults this to refuse INSERTs that would otherwise
	// silently stringify into a JSON/LIST/STRUCT/MAP/etc. remote column.
	void MarkVarcharFallback(const string &column_name) {
		varchar_fallback_columns_.insert(column_name);
	}
	bool IsVarcharFallbackColumn(const string &column_name) const {
		return varchar_fallback_columns_.find(column_name) != varchar_fallback_columns_.end();
	}

	unique_ptr<BaseStatistics> GetStatistics(ClientContext &, column_t) override { return nullptr; }
	TableStorageInfo            GetStorageInfo(ClientContext &) override { return TableStorageInfo {}; }

	TableFunction GetScanFunction(ClientContext &, unique_ptr<FunctionData> &bind_data) override;

	// Base-class overrides. Required even for some DUCKDB_API-tagged methods
	// because DuckDB's release binary doesn't reliably export them on Linux
	// or native-arm64 macOS (the annotation in the header does not guarantee
	// presence in the shipped .so/.dylib — LTO / visibility / version-script
	// strip can drop them). Without these overrides, our vtable slots resolve
	// to hidden host symbols and dlopen fails with `undefined symbol`.
	//
	// Semantics mirror the DuckDB defaults: write paths throw (ripdb is a
	// read-only view of a remote database); pure-notification paths no-op;
	// GetInfo re-implements TableCatalogEntry::GetInfo inline so DESCRIBE
	// and friends keep working.
	unique_ptr<CatalogEntry> AlterEntry(ClientContext &, AlterInfo &) override {
		throw PermissionException("ripdb: remote tables are read-only — ALTER is not supported");
	}
	unique_ptr<CatalogEntry> AlterEntry(CatalogTransaction, AlterInfo &) override {
		throw PermissionException("ripdb: remote tables are read-only — ALTER is not supported");
	}
	void UndoAlter(ClientContext &, AlterInfo &) override {}
	unique_ptr<CatalogEntry> Copy(ClientContext &) const override {
		throw InternalException("ripdb: Copy() is not supported on remote tables");
	}
	void SetAsRoot() override {}
	void Verify(Catalog &) override {}
	void Rollback(CatalogEntry &) override {}
	void OnDrop() override {}

	// Inline reimplementations of TableCatalogEntry::GetInfo and ::ToSQL —
	// identical to the stock DuckDB impls but defined in our .so so no
	// external symbol is needed. All accessed members (columns/constraints
	// via protected, catalog/schema/name/comment/tags/temporary/internal/
	// dependencies via public) resolve to the base-class member layout at
	// compile time, and CreateInfo::ToString is DUCKDB_API so it survives.
	unique_ptr<CreateInfo> GetInfo() const override {
		auto result = make_uniq<CreateTableInfo>();
		result->catalog = catalog.GetName();
		result->schema = schema.name;
		result->table = name;
		result->columns = columns.Copy();
		result->constraints.reserve(constraints.size());
		result->dependencies = dependencies;
		for (auto &c : constraints) result->constraints.emplace_back(c->Copy());
		result->temporary = temporary;
		result->internal = internal;
		result->comment = comment;
		result->tags = tags;
		return std::move(result);
	}
	string ToSQL() const override {
		auto create_info = GetInfo();
		return create_info->ToString();
	}

	// Remaining non-DUCKDB_API TableCatalogEntry virtuals. Each mirrors the
	// stock base-class default so host behaviour is preserved. Moving them
	// into the .so keeps our vtable self-contained on Linux where the host
	// doesn't export them.
	DataTable &GetStorage() override {
		throw InternalException("ripdb: GetStorage called on a remote table (not a DuckTableEntry)");
	}
	unique_ptr<BlockingSample> GetSample() override { return nullptr; }
	TableFunction GetScanFunction(ClientContext &context, unique_ptr<FunctionData> &bind_data,
	                              const EntryLookupInfo &) override {
		return GetScanFunction(context, bind_data);
	}
	vector<ColumnSegmentInfo> GetColumnSegmentInfo(const QueryContext &) override { return {}; }
	void BindUpdateConstraints(Binder &, LogicalGet &, LogicalProjection &, LogicalUpdate &,
	                           ClientContext &) override {
		// No-op: rip-db enforces constraints server-side. Without overriding
		// this to no-op, the binder throws before our PlanUpdate ever runs,
		// because the default base implementation tries to fetch DuckDB-style
		// constraint metadata from this table — metadata we don't have for
		// remote-backed tables. Local-only constraint validation isn't
		// meaningful here anyway.
	}
	virtual_column_map_t GetVirtualColumns() const override {
		virtual_column_map_t cols;
		cols.insert(make_pair(COLUMN_IDENTIFIER_ROW_ID, TableColumn("rowid", LogicalType::ROW_TYPE)));
		return cols;
	}
	vector<column_t> GetRowIdColumns() const override {
		return { COLUMN_IDENTIFIER_ROW_ID };
	}

private:
	string remote_name_;
	case_insensitive_set_t varchar_fallback_columns_;
};

// ---------------------------------------------------------------------------
// RipSchemaEntry. Owns the (case-insensitive) table map.
// ---------------------------------------------------------------------------

class RipSchemaEntry : public SchemaCatalogEntry {
public:
	RipSchemaEntry(Catalog &catalog, CreateSchemaInfo &info) : SchemaCatalogEntry(catalog, info) {
	}

	void AddTable(unique_ptr<RipTableEntry> table) {
		tables_[table->name] = std::move(table);
	}

	void Scan(ClientContext &, CatalogType type, const std::function<void(CatalogEntry &)> &callback) override {
		if (type != CatalogType::TABLE_ENTRY) return;
		for (auto &kv : tables_) callback(*kv.second);
	}
	void Scan(CatalogType type, const std::function<void(CatalogEntry &)> &callback) override {
		if (type != CatalogType::TABLE_ENTRY) return;
		for (auto &kv : tables_) callback(*kv.second);
	}

	optional_ptr<CatalogEntry> LookupEntry(CatalogTransaction, const EntryLookupInfo &info) override {
		if (info.GetCatalogType() != CatalogType::TABLE_ENTRY) {
			return nullptr;
		}
		auto it = tables_.find(info.GetEntryName());
		if (it == tables_.end()) return nullptr;
		return it->second.get();
	}

	// All Create*/DropEntry/Alter throw — DDL is not exposed via ripdb.
	// (DML — INSERT/UPDATE/DELETE — is supported via PlanInsert/Update/Delete
	// and forwards to the remote server. DDL is intentionally not.)
	[[noreturn]] static void ReadOnly(const char *what) {
		throw PermissionException(
		    "ripdb: %s is not supported by the ripdb extension — DDL must be "
		    "issued directly against the rip-db server (DML is supported)", what);
	}

	optional_ptr<CatalogEntry> CreateTable(CatalogTransaction, BoundCreateTableInfo &) override          { ReadOnly("CREATE TABLE"); }
	optional_ptr<CatalogEntry> CreateFunction(CatalogTransaction, CreateFunctionInfo &) override         { ReadOnly("CREATE FUNCTION"); }
	optional_ptr<CatalogEntry> CreateIndex(CatalogTransaction, CreateIndexInfo &, TableCatalogEntry &) override { ReadOnly("CREATE INDEX"); }
	optional_ptr<CatalogEntry> CreateView(CatalogTransaction, CreateViewInfo &) override                 { ReadOnly("CREATE VIEW"); }
	optional_ptr<CatalogEntry> CreateSequence(CatalogTransaction, CreateSequenceInfo &) override         { ReadOnly("CREATE SEQUENCE"); }
	optional_ptr<CatalogEntry> CreateTableFunction(CatalogTransaction, CreateTableFunctionInfo &) override { ReadOnly("CREATE TABLE FUNCTION"); }
	optional_ptr<CatalogEntry> CreateCopyFunction(CatalogTransaction, CreateCopyFunctionInfo &) override { ReadOnly("CREATE COPY FUNCTION"); }
	optional_ptr<CatalogEntry> CreatePragmaFunction(CatalogTransaction, CreatePragmaFunctionInfo &) override { ReadOnly("CREATE PRAGMA FUNCTION"); }
	optional_ptr<CatalogEntry> CreateCollation(CatalogTransaction, CreateCollationInfo &) override       { ReadOnly("CREATE COLLATION"); }
	optional_ptr<CatalogEntry> CreateType(CatalogTransaction, CreateTypeInfo &) override                 { ReadOnly("CREATE TYPE"); }

	void DropEntry(ClientContext &, DropInfo &) override                                                 { ReadOnly("DROP"); }
	void Alter(CatalogTransaction, AlterInfo &) override                                                 { ReadOnly("ALTER"); }

	// CatalogEntry base-class overrides. See RipTableEntry for the full
	// rationale — on Linux these symbols aren't exported by the duckdb
	// runtime, so the vtable needs our own definitions to keep dlopen
	// self-contained. Write paths throw (ripdb is read-only); pure-
	// notification paths no-op.
	unique_ptr<CatalogEntry> AlterEntry(ClientContext &, AlterInfo &) override         { ReadOnly("ALTER"); }
	unique_ptr<CatalogEntry> AlterEntry(CatalogTransaction, AlterInfo &) override      { ReadOnly("ALTER"); }
	void UndoAlter(ClientContext &, AlterInfo &) override {}
	unique_ptr<CatalogEntry> Copy(ClientContext &) const override {
		throw InternalException("ripdb: Copy() is not supported on the remote schema");
	}
	void SetAsRoot() override {}
	void Verify(Catalog &) override {}
	void Rollback(CatalogEntry &) override {}
	void OnDrop() override {}

private:
	case_insensitive_map_t<unique_ptr<RipTableEntry>> tables_;
};

// ---------------------------------------------------------------------------
// RipCatalog — owns the single 'main' schema and the HTTP client.
// ---------------------------------------------------------------------------

// Stats returned by a catalog populate/refresh pass — surfaced by
// rip_refresh() so users can see at a glance what happened.
struct RipRefreshStats {
	int64_t loaded  = 0;   // tables successfully registered
	int64_t refused = 0;   // tables skipped (refused type, per-table error, etc.)
};

class RipCatalog : public Catalog {
public:
	RipCatalog(AttachedDatabase &db, RipConnOptions options)
	    : Catalog(db), options_(std::move(options)),
	      http_(make_uniq<RipHttpClient>(db.GetDatabase(), options_)) {
	}
	~RipCatalog() override = default;

public:
	void Initialize(bool /*load_builtin*/) override {
		CreateSchemaInfo info;
		info.schema = "main";
		info.internal = true;
		main_schema_ = make_uniq<RipSchemaEntry>(*this, info);
		last_refresh_stats_ = PopulateSchema(*main_schema_);
	}

	// Refresh: rebuild the catalog from the remote /tables + /schema/:t
	// endpoints. Swaps in a NEW RipSchemaEntry with fresh RipTableEntry
	// instances, so any cached optional_ptr<CatalogEntry> in DuckDB's
	// binder (from previous queries) becomes stale. This is by design
	// — the whole point of refresh is to pick up remote schema changes,
	// which in DuckDB means rebinding.
	//
	// Callers must ensure no query that holds pointers into this
	// catalog's tables is currently executing. `rip_refresh('r')` runs
	// at query boundaries, which satisfies this.
	RipRefreshStats Refresh() {
		CreateSchemaInfo info;
		info.schema = "main";
		info.internal = true;
		auto new_schema = make_uniq<RipSchemaEntry>(*this, info);
		auto stats = PopulateSchema(*new_schema);
		main_schema_ = std::move(new_schema);
		last_refresh_stats_ = stats;
		return stats;
	}

	const RipRefreshStats &LastRefreshStats() const { return last_refresh_stats_; }

	string GetCatalogType() override { return "ripdb"; }

	optional_ptr<SchemaCatalogEntry>
	LookupSchema(CatalogTransaction, const EntryLookupInfo &info, OnEntryNotFound if_not_found) override {
		const string &name = info.GetEntryName();
		// Match either "main" or empty (default). Anything else → not found.
		if (name.empty() || StringUtil::CIEquals(name, "main")) {
			return main_schema_.get();
		}
		if (if_not_found == OnEntryNotFound::THROW_EXCEPTION) {
			throw CatalogException("ripdb catalog has no schema named '%s'", name);
		}
		return nullptr;
	}

	void ScanSchemas(ClientContext &, std::function<void(SchemaCatalogEntry &)> callback) override {
		callback(*main_schema_);
	}

	optional_ptr<CatalogEntry> CreateSchema(CatalogTransaction, CreateSchemaInfo &) override {
		RipSchemaEntry::ReadOnly("CREATE SCHEMA");
	}

	// CTAS remains read-only (DDL is out of scope for v1).
	PhysicalOperator &PlanCreateTableAs(ClientContext &, PhysicalPlanGenerator &, LogicalCreateTable &, PhysicalOperator &) override {
		RipSchemaEntry::ReadOnly("CREATE TABLE AS");
	}
	// DML — defined out-of-line below; see "DML dispatch implementation".
	PhysicalOperator &PlanInsert(ClientContext &context, PhysicalPlanGenerator &gen,
	                             LogicalInsert &op, optional_ptr<PhysicalOperator> plan) override;
	PhysicalOperator &PlanDelete(ClientContext &context, PhysicalPlanGenerator &gen,
	                             LogicalDelete &op, PhysicalOperator &plan) override;
	PhysicalOperator &PlanUpdate(ClientContext &context, PhysicalPlanGenerator &gen,
	                             LogicalUpdate &op, PhysicalOperator &plan) override;

	DatabaseSize GetDatabaseSize(ClientContext &) override { return DatabaseSize{}; }
	bool         InMemory()                       override { return false; }
	string       GetDBPath()                      override { return options_.base_url; }

	RipHttpClient &Http() { return *http_; }
	const RipConnOptions &Options() const { return options_; }

private:
	// DropSchema is a private pure virtual on Catalog. We must override it
	// even though it's private in the base — the override satisfies the vtable.
	void DropSchema(ClientContext &, DropInfo &) override {
		RipSchemaEntry::ReadOnly("DROP SCHEMA");
	}

	RipRefreshStats PopulateSchema(RipSchemaEntry &schema);

private:
	RipConnOptions               options_;
	unique_ptr<RipHttpClient>    http_;
	unique_ptr<RipSchemaEntry>   main_schema_;
	RipRefreshStats              last_refresh_stats_;
};

// ===========================================================================
// DML dispatch implementation
//
// Wires the helpers from earlier in this file (FormatLiteralForDML, the AST
// rewriter, the dependency walker, the reject-list checks) to the three
// physical operators below, and ultimately to RipCatalog::PlanInsert /
// PlanUpdate / PlanDelete.
// ===========================================================================

// ---------------------------------------------------------------------------
// HTTP exec helper.
//
// POSTs SQL to /ddb/exec on the rip-db server and parses the affected_rows
// out of the JSON envelope. Returns the count as int64. Throws IOException
// on network errors, malformed envelopes, or affected_rows > INT64_MAX.
//
// affected_rows is a STRING in the wire envelope (decimal) to dodge JS
// precision loss > 2^53 — see /ddb/exec in db.rip and the matching FFI
// binding in lib/duckdb.mjs.
// ---------------------------------------------------------------------------
static int64_t RipPostExec(RipHttpClient &http, const string &sql) {
	string body = http.PostBinary("/ddb/exec", "text/plain", sql);
	auto doc = duckdb_yyjson::yyjson_read(body.data(), body.size(), 0);
	if (!doc) {
		throw IOException("ripdb: /ddb/exec returned non-JSON body: %s", body);
	}
	auto root = duckdb_yyjson::yyjson_doc_get_root(doc);
	auto ok_v = duckdb_yyjson::yyjson_obj_get(root, "ok");
	if (ok_v && duckdb_yyjson::yyjson_is_bool(ok_v) && !duckdb_yyjson::yyjson_get_bool(ok_v)) {
		// Server-side error envelope { ok:false, error, errorCode, ... }
		auto err_v = duckdb_yyjson::yyjson_obj_get(root, "error");
		string err_msg = (err_v && duckdb_yyjson::yyjson_is_str(err_v))
		                    ? string(duckdb_yyjson::yyjson_get_str(err_v),
		                             duckdb_yyjson::yyjson_get_len(err_v))
		                    : "(no message)";
		duckdb_yyjson::yyjson_doc_free(doc);
		throw IOException("ripdb: /ddb/exec server error: %s", err_msg);
	}
	auto affected_v = duckdb_yyjson::yyjson_obj_get(root, "affected_rows");
	if (!affected_v || !duckdb_yyjson::yyjson_is_str(affected_v)) {
		duckdb_yyjson::yyjson_doc_free(doc);
		throw IOException("ripdb: /ddb/exec response missing affected_rows string");
	}
	string s(duckdb_yyjson::yyjson_get_str(affected_v),
	         duckdb_yyjson::yyjson_get_len(affected_v));
	duckdb_yyjson::yyjson_doc_free(doc);

	// Parse with overflow check. strtoll sets errno=ERANGE on overflow.
	errno = 0;
	char *end = nullptr;
	long long n = std::strtoll(s.c_str(), &end, 10);
	if (errno == ERANGE || end == s.c_str() || (end && *end != '\0')) {
		throw IOException("ripdb: /ddb/exec affected_rows '%s' is not a valid int64", s);
	}
	return static_cast<int64_t>(n);
}

// ---------------------------------------------------------------------------
// PhysicalRipPassthrough — source-only operator that owns a fully-formed
// SQL string and POSTs it to /ddb/exec on the first GetData call.
//
// Used by Path 1 (source-AST passthrough) for INSERT/UPDATE/DELETE that
// don't need any local-side child execution.
// ---------------------------------------------------------------------------

class PhysicalRipPassthrough : public PhysicalOperator {
public:
	static constexpr PhysicalOperatorType TYPE = PhysicalOperatorType::EXTENSION;

	PhysicalRipPassthrough(PhysicalPlan &physical_plan, RipCatalog &catalog,
	                       string sql, idx_t estimated_cardinality)
	    : PhysicalOperator(physical_plan, TYPE, {LogicalType::BIGINT}, estimated_cardinality),
	      catalog_(catalog), sql_(std::move(sql)) {}

	bool IsSource() const override { return true; }

	class GlobalState : public GlobalSourceState {
	public:
		bool emitted = false;
		idx_t MaxThreads() override { return 1; }
	};

	unique_ptr<GlobalSourceState> GetGlobalSourceState(ClientContext &) const override {
		return make_uniq<GlobalState>();
	}

	SourceResultType GetDataInternal(ExecutionContext &, DataChunk &chunk,
	                                 OperatorSourceInput &input) const override {
		auto &state = input.global_state.Cast<GlobalState>();
		if (state.emitted) {
			chunk.SetCardinality(0);
			return SourceResultType::FINISHED;
		}
		int64_t affected = RipPostExec(catalog_.Http(), sql_);
		auto *out = ripdb_compat::FlatVecMutable<int64_t>(chunk.data[0]);
		out[0] = affected;
		chunk.SetCardinality(1);
		state.emitted = true;
		return SourceResultType::FINISHED;
	}

	string GetName() const override { return "RIP_DML_PASSTHROUGH"; }

private:
	RipCatalog &catalog_;
	string      sql_;
};

// ---------------------------------------------------------------------------
// PhysicalRipInsertSink — sink+source operator that buffers child input
// chunks, then on Finalize emits one INSERT INTO ... VALUES (...) statement
// with typed literals and POSTs it to /ddb/exec.
//
// Bounded by:
//   - row count   (default 1,000,000 rows)
//   - byte size   (default 64 MiB of generated SQL text)
//
// Exceeding either cap throws — by design. This keeps the operation
// atomic-by-construction (single /ddb/exec request) at the cost of
// rejecting genuinely huge bulk loads. A future server-side transactional
// bulk endpoint would lift this cap.
// ---------------------------------------------------------------------------

class PhysicalRipInsertSink : public PhysicalOperator {
public:
	static constexpr PhysicalOperatorType TYPE = PhysicalOperatorType::EXTENSION;
	static constexpr idx_t  DEFAULT_ROW_CAP  = 1000000;
	static constexpr size_t DEFAULT_BYTE_CAP = 64 * 1024 * 1024;

	PhysicalRipInsertSink(PhysicalPlan &physical_plan, RipCatalog &catalog,
	                      string remote_table,
	                      vector<string> column_names,
	                      vector<LogicalType> column_types,
	                      vector<bool> column_is_fallback,
	                      idx_t estimated_cardinality)
	    : PhysicalOperator(physical_plan, TYPE, {LogicalType::BIGINT}, estimated_cardinality),
	      catalog_(catalog),
	      remote_table_(std::move(remote_table)),
	      column_names_(std::move(column_names)),
	      column_types_(std::move(column_types)),
	      column_is_fallback_(std::move(column_is_fallback)) {}

	bool IsSink() const override   { return true; }
	bool IsSource() const override { return true; }
	bool ParallelSink() const override { return false; }

	// ------------- Sink state ------------
	class GlobalSinkStateImpl : public GlobalSinkState {
	public:
		mutex                       lock;
		vector<vector<string>>      formatted_rows;  // row -> formatted literal per column
		size_t                      total_bytes = 0;
		int64_t                     affected    = 0;
		bool                        finalized   = false;
	};
	class LocalSinkStateImpl : public LocalSinkState {};

	unique_ptr<GlobalSinkState> GetGlobalSinkState(ClientContext &) const override {
		return make_uniq<GlobalSinkStateImpl>();
	}
	unique_ptr<LocalSinkState> GetLocalSinkState(ExecutionContext &) const override {
		return make_uniq<LocalSinkStateImpl>();
	}

	SinkResultType Sink(ExecutionContext &, DataChunk &chunk, OperatorSinkInput &input) const override {
		auto &g = input.global_state.Cast<GlobalSinkStateImpl>();
		std::lock_guard<mutex> guard(g.lock);

		const idx_t n_rows = chunk.size();
		const idx_t n_cols = column_types_.size();
		if (chunk.ColumnCount() != n_cols) {
			throw InternalException(
			    "ripdb: PhysicalRipInsertSink received chunk with %llu cols, expected %llu",
			    (unsigned long long)chunk.ColumnCount(), (unsigned long long)n_cols);
		}

		for (idx_t r = 0; r < n_rows; ++r) {
			vector<string> formatted;
			formatted.reserve(n_cols);
			// Per-row SQL bytes:
			//   "(" + cells + ")" with ", " between cells.
			// The shared per-statement overhead (`INSERT INTO "..." (cols)
			// VALUES `, plus ", " between rows) is counted separately at
			// Finalize-time before we commit the SQL string.
			size_t row_bytes = 2; // surrounding parens
			if (n_cols > 0) {
				row_bytes += (n_cols - 1) * 2; // ", " separators
			}
			for (idx_t c = 0; c < n_cols; ++c) {
				// Refuse to write through the catalog's VARCHAR mask into a
				// column that's actually a native nested/binary type on
				// the remote (LIST/STRUCT/MAP/ARRAY/JSON/etc.). The read
				// path is allowed to surface those as VARCHAR for ergonomic
				// reasons, but the write path can't reliably round-trip a
				// stringified value back into the native form.
				if (c < column_is_fallback_.size() && column_is_fallback_[c]) {
					throw NotImplementedException(
					    "ripdb: column '%s' is exposed as VARCHAR but the remote "
					    "type is a native nested/binary form (LIST/STRUCT/MAP/"
					    "ARRAY/JSON/ENUM/BIT/...). The v1 DML write path can't "
					    "round-trip a string into the native shape; INSERT this "
					    "value directly via the rip-db UI or the /sql endpoint.",
					    column_names_[c]);
				}
				Value v = chunk.GetValue(c, r);
				string lit;
				if (!FormatLiteralForDML(v, column_types_[c], lit)) {
					throw NotImplementedException(
					    "ripdb: cannot format value for INSERT into column '%s' "
					    "(type %s) — value or type isn't yet supported by the v1 "
					    "DML write path (e.g. embedded NUL in VARCHAR, native "
					    "nested type, etc.). Use the rip-db UI for now.",
					    column_names_[c], column_types_[c].ToString());
				}
				row_bytes += lit.size();
				formatted.push_back(std::move(lit));
			}
			g.total_bytes += row_bytes;
			g.formatted_rows.push_back(std::move(formatted));

			if (g.formatted_rows.size() > DEFAULT_ROW_CAP) {
				throw NotImplementedException(
				    "ripdb: bulk INSERT exceeded row cap (%llu rows). The v1 sink-fallback "
				    "path is single-request and atomic by construction; batch the INSERT "
				    "into smaller statements or use a server-side bulk endpoint.",
				    (unsigned long long)DEFAULT_ROW_CAP);
			}
			if (g.total_bytes > DEFAULT_BYTE_CAP) {
				throw NotImplementedException(
				    "ripdb: bulk INSERT exceeded SQL byte cap (~%zu MiB). Batch into "
				    "smaller statements; a typed-binary bulk endpoint is on the roadmap.",
				    DEFAULT_BYTE_CAP / (1024 * 1024));
			}
		}
		return SinkResultType::NEED_MORE_INPUT;
	}

	SinkCombineResultType Combine(ExecutionContext &, OperatorSinkCombineInput &) const override {
		return SinkCombineResultType::FINISHED;
	}

	SinkFinalizeType Finalize(Pipeline &, Event &, ClientContext &,
	                          OperatorSinkFinalizeInput &input) const override {
		auto &g = input.global_state.Cast<GlobalSinkStateImpl>();
		if (g.formatted_rows.empty()) {
			g.finalized = true;
			g.affected  = 0;
			return SinkFinalizeType::READY;
		}

		// Build the SQL. Reserve the exact final size up front so we
		// know it before issuing the request, AND so we don't pay
		// repeated string reallocations during construction.
		const string table_quoted = "\"main\"." + QuoteIdentifier(remote_table_);
		string col_list_sql;
		for (size_t i = 0; i < column_names_.size(); ++i) {
			if (i) col_list_sql += ", ";
			col_list_sql += QuoteIdentifier(column_names_[i]);
		}
		// Header: `INSERT INTO "main"."t" (cols) VALUES ` + per-row
		// content + `, ` between rows.
		const string header = "INSERT INTO " + table_quoted + " (" + col_list_sql + ") VALUES ";
		size_t total_size = header.size();
		for (size_t r = 0; r < g.formatted_rows.size(); ++r) {
			if (r) total_size += 2; // ", "
			total_size += 2;        // "(" and ")"
			const auto &row = g.formatted_rows[r];
			if (!row.empty()) total_size += (row.size() - 1) * 2; // ", " between cells
			for (const auto &lit : row) total_size += lit.size();
		}
		// Hard cap on the FULL serialized SQL. The Sink-time `g.total_bytes`
		// counter approximates this, but the header (table name + column
		// list) wasn't known until Finalize. Re-check here so the cap is
		// the actual byte size on the wire, not the sink-time estimate.
		if (total_size > DEFAULT_BYTE_CAP) {
			throw NotImplementedException(
			    "ripdb: bulk INSERT serialized to ~%zu MiB of SQL, which exceeds "
			    "the v1 cap of %zu MiB. Batch the INSERT into smaller statements; "
			    "a typed-binary bulk endpoint is on the roadmap.",
			    total_size / (1024 * 1024),
			    DEFAULT_BYTE_CAP / (1024 * 1024));
		}

		string sql;
		sql.reserve(total_size);
		sql.append(header);
		for (size_t r = 0; r < g.formatted_rows.size(); ++r) {
			if (r) sql += ", ";
			sql += "(";
			for (size_t c = 0; c < g.formatted_rows[r].size(); ++c) {
				if (c) sql += ", ";
				sql += g.formatted_rows[r][c];
			}
			sql += ")";
		}

		g.affected  = RipPostExec(catalog_.Http(), sql);
		g.finalized = true;
		// Free buffer memory once we've sent it.
		g.formatted_rows.clear();
		g.formatted_rows.shrink_to_fit();
		return SinkFinalizeType::READY;
	}

	// ------------- Source state ------------
	class SourceStateImpl : public GlobalSourceState {
	public:
		bool emitted = false;
		idx_t MaxThreads() override { return 1; }
	};

	unique_ptr<GlobalSourceState> GetGlobalSourceState(ClientContext &) const override {
		return make_uniq<SourceStateImpl>();
	}

	SourceResultType GetDataInternal(ExecutionContext &, DataChunk &chunk,
	                                 OperatorSourceInput &input) const override {
		auto &src = input.global_state.Cast<SourceStateImpl>();
		if (src.emitted) {
			chunk.SetCardinality(0);
			return SourceResultType::FINISHED;
		}
		auto &g = sink_state->Cast<GlobalSinkStateImpl>();
		if (!g.finalized) {
			// Should never happen — pipeline executor calls Finalize before
			// any source pull. Treat as internal invariant violation.
			throw InternalException("ripdb: PhysicalRipInsertSink source pull before Finalize");
		}
		auto *out = ripdb_compat::FlatVecMutable<int64_t>(chunk.data[0]);
		out[0] = g.affected;
		chunk.SetCardinality(1);
		src.emitted = true;
		return SourceResultType::FINISHED;
	}

	string GetName() const override { return "RIP_INSERT_SINK"; }

private:
	RipCatalog          &catalog_;
	string               remote_table_;
	vector<string>       column_names_;
	vector<LogicalType>  column_types_;
	vector<bool>         column_is_fallback_;  // remote-native (LIST/STRUCT/JSON/...) masquerading as VARCHAR
};

// ---------------------------------------------------------------------------
// Common pre-flight guards for any DML.
//
// Throw with a clear message rather than silently letting a misbehaving
// statement reach /ddb/exec. Order matters — auto-commit check first
// because that's the most surprising failure mode for users (no error
// message would otherwise hint that local BEGIN/ROLLBACK doesn't honor
// remote DML).
// ---------------------------------------------------------------------------
static void EnforceDmlPreflight(ClientContext &context, const TableCatalogEntry &table) {
	if (!context.transaction.IsAutoCommit()) {
		throw NotImplementedException(
		    "ripdb: DML inside an explicit transaction is not supported "
		    "(remote autocommits independently of local BEGIN/ROLLBACK). "
		    "COMMIT or ROLLBACK the local transaction first.");
	}
	// Identifier sanity (P3 belt-and-suspenders — PopulateSchema already
	// rejects non-conforming names at attach, but if a future code path
	// constructs a RipTableEntry directly this catches it).
	if (!IsSafeAsciiIdentifier(table.name)) {
		throw NotImplementedException(
		    "ripdb: table identifier '%s' uses characters that aren't yet "
		    "supported by the DML path.", table.name);
	}
}

// Try Path 1 (source-AST passthrough) for the supplied LogicalOperator.
// Returns:
//   - non-null PhysicalOperator → emit it; passthrough succeeded
//   - nullptr                   → caller falls back to Path 2 (INSERT only)
//                                 or throws (UPDATE/DELETE)
// Throws NotImplementedException with workaround guidance for the explicit
// reject list (RETURNING, ON CONFLICT, multi-statement, etc.).
// Schema-drift safety: ensure an InsertStatement's column list is explicit.
//
// `INSERT INTO t VALUES (...)` (no column list) binds positionally on the
// remote against whatever the remote's CURRENT schema looks like. If the
// remote table changed between attach and DML — column reorder, column add,
// column drop — the values land in the wrong physical columns. Local
// validation has already confirmed the values match the cached schema, so
// we know the right names; lock them in.
//
// No-op if the user already wrote an explicit column list.
static void EnsureInsertColumnList(InsertStatement &ins, const RipTableEntry &table) {
	if (!ins.columns.empty()) return;
	const auto &cols = table.GetColumns();
	ins.columns.reserve(cols.LogicalColumnCount());
	for (auto &col : cols.Logical()) {
		ins.columns.push_back(col.GetName());
	}
}

// Refuse to UPDATE a fallback-VARCHAR column (catalog says VARCHAR but the
// remote is a native nested/binary type). Mirrors CheckInsertFallbackVarchar
// but consults the bound LogicalUpdate's column list (which the binder
// already resolved to physical-index references on the target table).
static string CheckUpdateFallbackVarchar(const LogicalUpdate &op,
                                          const RipTableEntry &table) {
	const auto &cols = table.GetColumns();
	for (auto phys_idx : op.columns) {
		// PhysicalIndex on the table's column list — translate to the
		// column name and consult the fallback set.
		if (phys_idx.index < cols.PhysicalColumnCount()) {
			const auto &col = cols.GetColumn(phys_idx);
			if (table.IsVarcharFallbackColumn(col.GetName())) {
				return StringUtil::Format(
				    "ripdb: UPDATE targets column '%s', which is exposed as VARCHAR "
				    "but is a native nested/binary type on the remote (LIST/STRUCT/"
				    "MAP/ARRAY/JSON/...). The v1 DML write path can't round-trip "
				    "this; use the rip-db UI for now.",
				    col.GetName());
			}
		}
	}
	return string();
}

// Refuse to forward an INSERT whose target columns include a fallback-VARCHAR
// column (catalog says VARCHAR but the remote column is native nested/binary).
// Same rationale as the sink path's per-cell check, just enforced earlier
// (before we serialize and post the SQL).
static string CheckInsertFallbackVarchar(const InsertStatement &ins,
                                          const RipTableEntry &table) {
	if (ins.columns.empty()) {
		// EnsureInsertColumnList should have populated this; if it didn't,
		// every table column is potentially being written.
		for (auto &col : table.GetColumns().Logical()) {
			if (table.IsVarcharFallbackColumn(col.GetName())) {
				return StringUtil::Format(
				    "ripdb: INSERT would write to column '%s', which is exposed "
				    "as VARCHAR but is a native nested/binary type on the remote "
				    "(LIST/STRUCT/MAP/ARRAY/JSON/...). The v1 DML write path "
				    "can't round-trip this. Use the rip-db UI for now.",
				    col.GetName());
			}
		}
		return string();
	}
	for (const auto &name : ins.columns) {
		if (table.IsVarcharFallbackColumn(name)) {
			return StringUtil::Format(
			    "ripdb: INSERT targets column '%s', which is exposed as VARCHAR "
			    "but is a native nested/binary type on the remote. The v1 DML "
			    "write path can't round-trip this. Use the rip-db UI for now.",
			    name);
		}
	}
	return string();
}

template <class StmtT>
static optional_ptr<PhysicalOperator>
TryPlanDmlPassthrough(ClientContext &context, PhysicalPlanGenerator &gen,
                      const LogicalOperator &logical_root,
                      const RipCatalog &our_catalog, RipCatalog &mutable_catalog,
                      string (*reject_check)(const StmtT &),
                      const char *stmt_label,
                      optional_ptr<const RipTableEntry> insert_target = nullptr) {
	const string &original_sql = context.GetCurrentQuery();
	if (original_sql.empty()) return nullptr;

	// Cross-path NUL safety FIRST — before any C-string FFI surface (the
	// parser, conn.query, lib/duckdb.mjs's toCString) sees the SQL. NULs
	// in VARCHAR values don't survive HTTP-as-text transport and tools
	// truncate at the first NUL byte. Refuse here rather than silently
	// truncate downstream.
	if (original_sql.find('\0') != string::npos) {
		throw NotImplementedException(
		    "ripdb: SQL contains an embedded NUL (\\0) byte. NULs in VARCHAR "
		    "values don't survive HTTP-as-text transport and tooling; the v1 "
		    "DML write path refuses rather than silently truncating.");
	}

	auto stmt = TryParseSingleStatement<StmtT>(original_sql);
	if (!stmt) {
		// Multi-statement input or different statement type → not eligible
		// for passthrough. The sink fallback (for INSERT) handles the
		// "different statement type" case (e.g. CREATE TABLE AS routes
		// through PlanCreateTableAs which we still throw, so that's fine).
		// The multi-statement case is a user error we should make loud.
		try {
			Parser p;
			p.ParseQuery(original_sql);
			if (p.statements.size() > 1) {
				throw NotImplementedException(
				    "ripdb: %s rejected — multi-statement input is not supported "
				    "via the ripdb passthrough (statement-index correlation isn't "
				    "exposed in DuckDB v1.5.2). Run each statement separately.",
				    stmt_label);
			}
		} catch (const NotImplementedException &) {
			throw;
		} catch (...) {
			// Parser threw — fall through to nullptr; caller decides.
		}
		return nullptr;
	}

	// Explicit reject list (RETURNING, ON CONFLICT, FROM, USING, ...).
	// Always runs — applies to both the passthrough and the sink-fallback
	// path that may follow.
	string reject_reason = reject_check(*stmt);
	if (!reject_reason.empty()) {
		throw NotImplementedException("ripdb: %s", reject_reason);
	}

	// Path decision for INSERT: only INSERT VALUES is passthrough-eligible.
	// INSERT...SELECT (in any form, including SELECT * FROM (VALUES ...))
	// must go through the sink fallback so the source binding is rooted
	// in the local DuckDB binder (which knows which ripdb attachment a
	// LogicalGet belongs to and materializes typed values to send remote).
	if (insert_target && stmt->type == StatementType::INSERT_STATEMENT) {
		const auto &ins = stmt->template Cast<InsertStatement>();
		if (!IsPureInsertValues(ins)) {
			return nullptr;
		}
	}

	// Bound-plan dependency walk: confirm every catalog-backed scan in the
	// subtree uses our `ripdb_scan` function. Any non-ripdb LogicalGet
	// (local DuckDB table, local table function, etc.) → caller falls back
	// to sink path (INSERT only) or throws (UPDATE/DELETE).
	if (!OnlyRipdbScans(logical_root)) {
		return nullptr;
	}

	// Multi-ripdb USE-attack defense — runs on the ORIGINAL parsed AST
	// BEFORE the rewriter canonicalizes anything. Source-position
	// BaseTableRefs must carry our local-attach catalog name in the
	// catalog or schema slot (i.e. `r.t` or `r.main.t`). Bare `t`,
	// pre-existing `main.t`, `s.t`, and `s.main.t` all reject. Without
	// this proof, a `USE s; UPDATE r.t SET col = (SELECT max FROM main.t)`
	// would forward `main.t` to r's server and silently mis-target.
	{
		string prov_reason = ValidateOriginalSourceProvenance(*stmt, our_catalog.GetName());
		if (!prov_reason.empty()) {
			throw NotImplementedException("ripdb: %s", prov_reason);
		}
	}

	// Structurally rewrite the catalog qualifier on FROM-clause TableRefs
	// and any nested-subquery TableRefs (via StripCatalogFromExpression in
	// SET/WHERE/SELECT-list etc.). Provably-ours refs get canonicalized to
	// `main.<table>`; the provenance check above guarantees no other
	// source refs survive to this point.
	RewriteCatalogQualifierInStatement(*stmt, our_catalog.GetName());

	// INSERT-only schema-drift safety: lock in explicit column names so the
	// remote doesn't bind positionally against a possibly-changed schema.
	// Also reject INSERT into a column whose catalog VARCHAR is a remote
	// native-type fallback (LIST/STRUCT/MAP/ARRAY/JSON/...).
	if (insert_target && stmt->type == StatementType::INSERT_STATEMENT) {
		auto &ins = stmt->template Cast<InsertStatement>();
		EnsureInsertColumnList(ins, *insert_target);
		string fb_reason = CheckInsertFallbackVarchar(ins, *insert_target);
		if (!fb_reason.empty()) {
			throw NotImplementedException("ripdb: %s", fb_reason);
		}
	}

	// AST safety walker (POST-rewrite): rowid / parameters / qualified-
	// ColumnRef leaks / unsupported TableRef or QueryNode forms / gross
	// BaseTableRef leftovers (anything the rewriter should have stripped).
	// Runs on the rewritten AST so the BaseTableRef qualifier check sees
	// the canonicalized form.
	{
		string safety_reason = ValidateRewrittenStatement(*stmt, our_catalog.GetName());
		if (!safety_reason.empty()) {
			throw NotImplementedException("ripdb: %s", safety_reason);
		}
	}

	string rewritten = stmt->ToString();
	return gen.Make<PhysicalRipPassthrough>(mutable_catalog, std::move(rewritten),
	                                         logical_root.estimated_cardinality);
}

// ---------------------------------------------------------------------------
// PlanInsert — Path 1 first, Path 2 (sink) fallback.
// ---------------------------------------------------------------------------
PhysicalOperator &RipCatalog::PlanInsert(ClientContext &context, PhysicalPlanGenerator &gen,
                                         LogicalInsert &op, optional_ptr<PhysicalOperator> plan) {
	auto &table = op.table.Cast<RipTableEntry>();
	EnforceDmlPreflight(context, table);

	// Reject native INSERT-time features the planner already knows about.
	if (op.return_chunk) {
		throw NotImplementedException(
		    "ripdb: INSERT ... RETURNING is not supported by ripdb in v1.");
	}
	if (op.on_conflict_info.action_type != OnConflictAction::THROW) {
		throw NotImplementedException(
		    "ripdb: INSERT ... ON CONFLICT (UPSERT) is not supported by ripdb in v1.");
	}

	// Path 1: passthrough. We pass `&table` as the insert_target so the
	// passthrough can inject an explicit column list when the user wrote
	// none — see EnsureInsertColumnList for the schema-drift rationale.
	auto passthrough = TryPlanDmlPassthrough<InsertStatement>(
	    context, gen, op, /*our_catalog=*/*this, /*mutable=*/*this,
	    RejectInsertStatement, "INSERT", &table);
	if (passthrough) return *passthrough;

	// Path 2: sink fallback. The DuckDB planner has built `plan` as the
	// physical subtree producing rows that flow into our INSERT. The sink
	// operator buffers them, formats typed literals, and POSTs one
	// INSERT INTO ... VALUES (...) statement on Finalize.
	if (!plan) {
		throw NotImplementedException(
		    "ripdb: INSERT requires a source plan (DEFAULT VALUES / inferred "
		    "DEFAULT not supported in v1).");
	}

	// Extract the target column names in expected_types order. DuckDB's
	// LogicalInsert.expected_types is the per-column type vector aligned to
	// the table's ColumnList; for a column-listed INSERT (`INSERT INTO t (a,b)
	// VALUES ...`), expected_types is the source-row layout of (a,b), not the
	// full table. We mirror that ordering.
	vector<string>      column_names;
	vector<LogicalType> column_types = op.expected_types;
	if (op.column_index_map.empty()) {
		// No explicit column list — input rows are positionally aligned to
		// the table's full column order.
		for (auto &col : table.GetColumns().Logical()) {
			column_names.push_back(col.GetName());
		}
	} else {
		// Build the source-order column-name list by inverting column_index_map:
		// column_index_map maps physical_index -> source_index, with INVALID_INDEX
		// for columns omitted from the INSERT. Iterate in source-index order.
		const auto &table_cols = table.GetColumns();
		column_names.assign(op.expected_types.size(), string());
		for (idx_t phys = 0; phys < op.column_index_map.size(); ++phys) {
			idx_t src_idx = op.column_index_map[PhysicalIndex(phys)];
			if (src_idx == DConstants::INVALID_INDEX) continue;
			if (src_idx < column_names.size()) {
				column_names[src_idx] = table_cols.GetColumn(PhysicalIndex(phys)).GetName();
			}
		}
		// Sanity: every source slot should now be filled.
		for (size_t i = 0; i < column_names.size(); ++i) {
			if (column_names[i].empty()) {
				throw InternalException(
				    "ripdb: failed to derive column name for INSERT source slot %zu", i);
			}
		}
	}

	// Per-column "is the remote actually a non-VARCHAR native type masquerading
	// as VARCHAR in the catalog?" bits. The sink path checks this on each
	// row and refuses to write if any targeted column is fallback-VARCHAR.
	vector<bool> column_is_fallback;
	column_is_fallback.reserve(column_names.size());
	for (const auto &name : column_names) {
		column_is_fallback.push_back(table.IsVarcharFallbackColumn(name));
	}

	auto &sink = gen.Make<PhysicalRipInsertSink>(*this, table.RemoteName(),
	                                              std::move(column_names),
	                                              std::move(column_types),
	                                              std::move(column_is_fallback),
	                                              op.estimated_cardinality);
	sink.children.push_back(*plan);
	return sink;
}

// ---------------------------------------------------------------------------
// PlanUpdate — Path 1 only; throw if not eligible.
// ---------------------------------------------------------------------------
PhysicalOperator &RipCatalog::PlanUpdate(ClientContext &context, PhysicalPlanGenerator &gen,
                                         LogicalUpdate &op, PhysicalOperator & /*plan*/) {
	auto &table = op.table.Cast<RipTableEntry>();
	EnforceDmlPreflight(context, table);

	if (op.return_chunk) {
		throw NotImplementedException(
		    "ripdb: UPDATE ... RETURNING is not supported by ripdb in v1.");
	}

	// Refuse UPDATE on a column whose catalog VARCHAR is a remote native
	// nested/binary fallback. (Same guarantee as INSERT — the v1 DML write
	// path can't round-trip a string into the native shape.)
	{
		string fb_reason = CheckUpdateFallbackVarchar(op, table);
		if (!fb_reason.empty()) {
			throw NotImplementedException("ripdb: %s", fb_reason);
		}
	}

	auto passthrough = TryPlanDmlPassthrough<UpdateStatement>(
	    context, gen, op, /*our_catalog=*/*this, /*mutable=*/*this,
	    RejectUpdateStatement, "UPDATE");
	if (passthrough) return *passthrough;

	throw NotImplementedException(
	    "ripdb: UPDATE could not be passed through to the remote (the statement "
	    "either uses an unsupported feature, or its WHERE/SET clause references "
	    "a local table). v1 only supports UPDATE statements that reference one "
	    "ripdb table and no local-catalog data. Materialize complex updates "
	    "via a temp table or run them directly against rip-db.");
}

// ---------------------------------------------------------------------------
// PlanDelete — Path 1 only; throw if not eligible.
// ---------------------------------------------------------------------------
PhysicalOperator &RipCatalog::PlanDelete(ClientContext &context, PhysicalPlanGenerator &gen,
                                         LogicalDelete &op, PhysicalOperator & /*plan*/) {
	auto &table = op.table.Cast<RipTableEntry>();
	EnforceDmlPreflight(context, table);

	if (op.return_chunk) {
		throw NotImplementedException(
		    "ripdb: DELETE ... RETURNING is not supported by ripdb in v1.");
	}

	auto passthrough = TryPlanDmlPassthrough<DeleteStatement>(
	    context, gen, op, /*our_catalog=*/*this, /*mutable=*/*this,
	    RejectDeleteStatement, "DELETE");
	if (passthrough) return *passthrough;

	throw NotImplementedException(
	    "ripdb: DELETE could not be passed through to the remote (either uses "
	    "an unsupported feature like USING or RETURNING, or its WHERE clause "
	    "references a local table). v1 only supports DELETE statements that "
	    "reference one ripdb table and no local-catalog data.");
}

// ---------------------------------------------------------------------------
// Catalog population: GET /tables  +  GET /schema/:t per table.
// ---------------------------------------------------------------------------

namespace {

using yyjson_doc = duckdb_yyjson::yyjson_doc;
using yyjson_val = duckdb_yyjson::yyjson_val;

vector<string> ParseTablesResponse(const string &body) {
	vector<string> out;
	auto doc = duckdb_yyjson::yyjson_read(body.data(), body.size(), 0);
	if (!doc) {
		throw IOException("ripdb: GET /tables returned non-JSON body");
	}
	auto root = duckdb_yyjson::yyjson_doc_get_root(doc);
	auto tables = duckdb_yyjson::yyjson_obj_get(root, "tables");
	if (!tables || !duckdb_yyjson::yyjson_is_arr(tables)) {
		duckdb_yyjson::yyjson_doc_free(doc);
		throw IOException("ripdb: GET /tables JSON missing 'tables' array");
	}
	size_t idx, max;
	yyjson_val *item;
	yyjson_arr_foreach(tables, idx, max, item) {
		if (duckdb_yyjson::yyjson_is_str(item)) {
			out.emplace_back(duckdb_yyjson::yyjson_get_str(item),
			                 duckdb_yyjson::yyjson_get_len(item));
		}
	}
	duckdb_yyjson::yyjson_doc_free(doc);
	return out;
}

RipTableMeta ParseSchemaResponse(const string &table_name, const string &body) {
	RipTableMeta meta;
	meta.name = table_name;

	auto doc = duckdb_yyjson::yyjson_read(body.data(), body.size(), 0);
	if (!doc) {
		throw IOException("ripdb: GET /schema/%s returned non-JSON body", table_name);
	}
	auto root = duckdb_yyjson::yyjson_doc_get_root(doc);
	auto schema_arr = duckdb_yyjson::yyjson_obj_get(root, "schema");
	if (!schema_arr || !duckdb_yyjson::yyjson_is_arr(schema_arr)) {
		// Server may have returned an error envelope. Surface it.
		auto err = duckdb_yyjson::yyjson_obj_get(root, "error");
		if (err && duckdb_yyjson::yyjson_is_str(err)) {
			string msg(duckdb_yyjson::yyjson_get_str(err), duckdb_yyjson::yyjson_get_len(err));
			duckdb_yyjson::yyjson_doc_free(doc);
			throw CatalogException("ripdb: GET /schema/%s reported: %s", table_name, msg);
		}
		duckdb_yyjson::yyjson_doc_free(doc);
		throw IOException("ripdb: GET /schema/%s JSON missing 'schema' array", table_name);
	}

	size_t idx, max;
	yyjson_val *item;
	yyjson_arr_foreach(schema_arr, idx, max, item) {
		auto name_v = duckdb_yyjson::yyjson_obj_get(item, "column_name");
		auto type_v = duckdb_yyjson::yyjson_obj_get(item, "column_type");
		if (!name_v || !type_v) continue;
		string col_name(duckdb_yyjson::yyjson_get_str(name_v), duckdb_yyjson::yyjson_get_len(name_v));
		string type_str(duckdb_yyjson::yyjson_get_str(type_v), duckdb_yyjson::yyjson_get_len(type_v));

		auto mapped = MapToWireType(type_str);
		if (mapped.refuse) {
			meta.refused = true;
			meta.refuse_reason = StringUtil::Format(
			    "ripdb: skipping table '%s' — column '%s' of type '%s': %s",
			    table_name, col_name, type_str, mapped.refuse_reason);
			break;
		}
		meta.columns.push_back({std::move(col_name), std::move(mapped.type),
		                         mapped.varchar_is_fallback});
	}
	duckdb_yyjson::yyjson_doc_free(doc);
	return meta;
}

} // anonymous namespace

// Identifier guard: until URL-encoding lands on the client AND the server-side
// `/schema/:table` strips its `[^a-zA-Z0-9_]` sanitizer, only ASCII identifiers
// are safe to round-trip. A non-conforming name today either silently misroutes
// (server strips characters, client doesn't, names mismatch on lookup) or fails
// to round-trip through DuckDB's identifier quoting in a way we can't detect
// at runtime. Refuse to attach such tables/columns rather than mutate the wrong
// data later. A future identifier-transport hardening pass will lift this.
static bool IsSafeAsciiIdentifier(const string &name) {
	if (name.empty()) return false;
	auto is_ident_first = [](char c) {
		return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == '_';
	};
	auto is_ident_cont = [](char c) {
		return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
		       (c >= '0' && c <= '9') || c == '_';
	};
	if (!is_ident_first(name[0])) return false;
	for (size_t i = 1; i < name.size(); ++i) {
		if (!is_ident_cont(name[i])) return false;
	}
	return true;
}

RipRefreshStats RipCatalog::PopulateSchema(RipSchemaEntry &schema) {
	RipRefreshStats stats;
	string tables_body = http_->GetText("/tables");
	auto names = ParseTablesResponse(tables_body);

	for (const auto &table_name : names) {
		// Identifier guard at attach time — see IsSafeAsciiIdentifier above.
		if (!IsSafeAsciiIdentifier(table_name)) {
			Printer::Print(StringUtil::Format(
			    "ripdb: skipping table '%s' — identifier contains characters "
			    "that are not yet supported over the wire (only [A-Za-z_][A-Za-z0-9_]* is safe). "
			    "See packages/db/CLI.md for the planned identifier-transport hardening.",
			    table_name));
			++stats.refused;
			continue;
		}

		string schema_body;
		try {
			schema_body = http_->GetText("/schema/" + table_name);
		} catch (const std::exception &e) {
			// Don't poison the whole attach because of one bad table.
			Printer::Print(StringUtil::Format(
			    "ripdb: failed to load schema for table '%s' (%s); skipping.", table_name, e.what()));
			++stats.refused;
			continue;
		}
		auto meta = ParseSchemaResponse(table_name, schema_body);
		if (meta.refused) {
			Printer::Print(meta.refuse_reason);
			++stats.refused;
			continue;
		}

		// Validate column identifiers too — same rationale as the table
		// guard above. A column with weird chars would silently mis-bind
		// on the wire (the server-side `/schema/:t` already escaped its
		// own `:t` arg, but the column names come back verbatim and we
		// emit them in SQL without further escaping).
		bool col_refused = false;
		for (auto &col : meta.columns) {
			if (!IsSafeAsciiIdentifier(col.name)) {
				Printer::Print(StringUtil::Format(
				    "ripdb: skipping table '%s' — column '%s' has an identifier "
				    "that is not yet supported over the wire.",
				    table_name, col.name));
				col_refused = true;
				break;
			}
		}
		if (col_refused) { ++stats.refused; continue; }

		CreateTableInfo info;
		info.catalog = GetName();
		info.schema  = "main";
		info.table   = meta.name;
		for (auto &col : meta.columns) {
			info.columns.AddColumn(ColumnDefinition(col.name, col.type));
		}
		auto table_entry = make_uniq<RipTableEntry>(*this, schema, info, meta.name);
		// Carry the "VARCHAR but actually native nested/binary on the remote"
		// markers onto the table entry so the DML write path can refuse
		// INSERTs that would silently coerce values into the wrong native
		// shape. Read path is unaffected (it stringifies on the wire and
		// hands back VARCHAR exactly as advertised).
		for (auto &col : meta.columns) {
			if (col.varchar_is_fallback) {
				table_entry->MarkVarcharFallback(col.name);
			}
		}
		schema.AddTable(std::move(table_entry));
		++stats.loaded;
	}
	return stats;
}

// ---------------------------------------------------------------------------
// Scan function implementation.
// ---------------------------------------------------------------------------

TableFunction RipTableEntry::GetScanFunction(ClientContext &, unique_ptr<FunctionData> &bind_data) {
	auto &cat = catalog.Cast<RipCatalog>();
	vector<string>        all_names;
	vector<LogicalType>   all_types;
	for (auto &col : columns.Logical()) {
		all_names.push_back(col.GetName());
		all_types.push_back(col.GetType());
	}
	auto bd = make_uniq<RipScanBindData>(cat.Options().base_url, "main", remote_name_,
	                                      std::move(all_names), std::move(all_types));
	// Surface ourselves as the catalog entry behind this scan so
	// LogicalGet::GetTable() resolves correctly — see RipScanGetBindInfo.
	bd->entry = this;
	bind_data = std::move(bd);
	return MakeRipScanFunction();
}

// Bind isn't used much — DuckDB calls it via the table-function path, but
// for catalog-backed scans the bind data is set up by GetScanFunction. We
// still implement it to satisfy the TableFunction contract; if invoked
// directly (e.g., `SELECT * FROM ripdb_scan(...)`), this would be where
// the work happens. For M1 we keep it minimal.
static unique_ptr<FunctionData>
RipScanBind(ClientContext &, TableFunctionBindInput &input,
            vector<LogicalType> &return_types, vector<string> &names) {
	if (!input.info) {
		throw NotImplementedException(
		    "ripdb: ripdb_scan() cannot be called directly; use ATTACH 'http://...' AS r (TYPE ripdb)");
	}
	// Bind data is supplied later by RipTableEntry::GetScanFunction; in this
	// path we just echo the columns back.
	return_types.clear();
	names.clear();
	return nullptr;
}

static string BuildRemoteSelect(const RipScanBindData &bd, const vector<idx_t> &projected_ids) {
	string sql = "SELECT ";
	for (size_t i = 0; i < projected_ids.size(); ++i) {
		if (i) sql += ", ";
		sql += QuoteIdentifier(bd.all_column_names[projected_ids[i]]);
	}
	sql += " FROM ";
	sql += QuoteIdentifier(bd.schema_name);
	sql += '.';
	sql += QuoteIdentifier(bd.table_name);
	// M2.1 — pushed predicates. AND-combined; DuckDB handles anything
	// left in its local plan (the complex-filter callback's contract).
	if (!bd.pushed_wheres.empty()) {
		sql += " WHERE ";
		for (size_t i = 0; i < bd.pushed_wheres.size(); ++i) {
			if (i) sql += " AND ";
			sql += bd.pushed_wheres[i];
		}
	}
	return sql;
}

static unique_ptr<GlobalTableFunctionState>
RipScanInitGlobal(ClientContext &context, TableFunctionInitInput &input) {
	auto &bd = input.bind_data->Cast<RipScanBindData>();
	auto state = make_uniq<RipScanGlobalState>();

	auto column_ids = input.column_ids;

	// Deduplicate real column projections so that if DuckDB (weirdly) asks
	// for the same column twice we still only fetch it once.
	case_insensitive_map_t<idx_t> seen;
	for (auto cid : column_ids) {
		RipScanGlobalState::OutCol oc;
		if (cid == COLUMN_IDENTIFIER_ROW_ID) {
			oc.remote_idx = RipScanGlobalState::ROWID_SLOT;
			oc.decoded_idx = 0;  // unused
		} else {
			if (cid >= bd.all_column_names.size()) {
				throw InternalException(
				    "ripdb: projection column id %llu out of range (table has %llu columns)",
				    static_cast<unsigned long long>(cid),
				    static_cast<unsigned long long>(bd.all_column_names.size()));
			}
			const string &nm = bd.all_column_names[cid];
			auto it = seen.find(nm);
			if (it == seen.end()) {
				oc.decoded_idx = state->remote_projected_ids.size();
				state->remote_projected_ids.push_back(cid);
				seen[nm] = oc.decoded_idx;
			} else {
				oc.decoded_idx = it->second;
			}
			oc.remote_idx = cid;
		}
		state->out_cols.push_back(oc);
	}

	// If the projection is entirely rowid (or entirely empty), we still need
	// to know the row count. Project column 0 as a harmless row-count probe.
	if (state->remote_projected_ids.empty()) {
		if (bd.all_column_names.empty()) {
			throw InvalidInputException(
			    "ripdb: cannot scan a table with zero columns ('%s')", bd.table_name);
		}
		state->remote_projected_ids.push_back(0);
	}

	// Issue the remote query.
	string sql = BuildRemoteSelect(bd, state->remote_projected_ids);

	// Re-derive an HTTP client. The catalog owns the long-lived one but it's
	// not directly reachable from here; build a fresh one per scan-init. This
	// is fine for M1 and avoids cross-thread sharing concerns once scans
	// can parallelize.
	auto &db = DatabaseInstance::GetDatabase(context);
	RipConnOptions opts;
	opts.base_url = bd.base_url;
	RipHttpClient http(db, opts);

	// Pass an explicit unlimited row-limit header. Without it, the server
	// previously fell back to a 10k cap (the DuckDB UI default), silently
	// truncating any scan over 10k rows. The server now treats absent
	// header as unlimited, but old servers in the field still cap at 10k,
	// so being explicit here is a belt-and-suspenders fix for both.
	string body = http.PostBinary("/ddb/run", "text/plain", sql,
	                              {{"x-duckdb-ui-result-row-limit", "-1"}});
	state->decoded = make_uniq<DecodedResult>(
	    decode(reinterpret_cast<const uint8_t *>(body.data()), body.size()));
	if (state->decoded->isError) {
		throw IOException("ripdb: remote /ddb/run reported error: %s",
		                  state->decoded->error.message);
	}
	if (state->decoded->success.columns.size() != state->remote_projected_ids.size()) {
		throw IOException("ripdb: remote returned %llu columns but %llu were projected",
		                  static_cast<unsigned long long>(state->decoded->success.columns.size()),
		                  static_cast<unsigned long long>(state->remote_projected_ids.size()));
	}

	// For DECIMAL columns, verify the wire-reported width/scale match
	// what the catalog handed us. A mismatch means the remote schema
	// changed between the attach-time DESCRIBE and this scan — easiest
	// recovery is to refresh and retry (rip_refresh('…')), and we'd
	// silently mis-write without this check.
	for (idx_t i = 0; i < state->decoded->success.columns.size(); ++i) {
		const auto &wire_col = state->decoded->success.columns[i];
		if (wire_col.typeId != 21 /* DECIMAL */) continue;
		idx_t remote_idx = state->remote_projected_ids[i];
		const auto &expected = bd.all_column_types[remote_idx];
		if (expected.id() != LogicalTypeId::DECIMAL) {
			throw IOException(
			    "ripdb: remote returned DECIMAL for column '%s' but catalog expected %s "
			    "(remote schema may have changed — call rip_refresh to reload)",
			    bd.all_column_names[remote_idx], expected.ToString());
		}
		uint8_t expected_w = DecimalType::GetWidth(expected);
		uint8_t expected_s = DecimalType::GetScale(expected);
		if (wire_col.decimal_width != expected_w || wire_col.decimal_scale != expected_s) {
			throw IOException(
			    "ripdb: remote returned DECIMAL(%u,%u) for column '%s' but catalog expected "
			    "DECIMAL(%u,%u) (remote schema may have changed — call rip_refresh to reload)",
			    (unsigned)wire_col.decimal_width, (unsigned)wire_col.decimal_scale,
			    bd.all_column_names[remote_idx], (unsigned)expected_w, (unsigned)expected_s);
		}
	}

	return std::move(state);
}

// Per-cell vector write. Caller has already verified type compatibility via bind.
// Strings/blobs are copied into DuckDB's heap via StringVector::AddString so
// they outlive the decoder's response buffer (Risk 2 / R2 in CLI.md).
static void WriteCellToVector(Vector &vec, idx_t row_idx, const Cell &cell) {
	if (cell.tag == Cell::NUL) {
		FlatVector::SetNull(vec, row_idx, true);
		return;
	}
	const auto &type = vec.GetType();
	switch (type.id()) {
	case LogicalTypeId::BOOLEAN:
		ripdb_compat::FlatVecMutable<bool>(vec)[row_idx] = cell.b;
		break;
	case LogicalTypeId::TINYINT:
		ripdb_compat::FlatVecMutable<int8_t>(vec)[row_idx] = static_cast<int8_t>(cell.i64);
		break;
	case LogicalTypeId::UTINYINT:
		ripdb_compat::FlatVecMutable<uint8_t>(vec)[row_idx] = static_cast<uint8_t>(cell.u64);
		break;
	case LogicalTypeId::SMALLINT:
		ripdb_compat::FlatVecMutable<int16_t>(vec)[row_idx] = static_cast<int16_t>(cell.i64);
		break;
	case LogicalTypeId::USMALLINT:
		ripdb_compat::FlatVecMutable<uint16_t>(vec)[row_idx] = static_cast<uint16_t>(cell.u64);
		break;
	case LogicalTypeId::INTEGER:
	case LogicalTypeId::DATE:
		ripdb_compat::FlatVecMutable<int32_t>(vec)[row_idx] = static_cast<int32_t>(cell.i64);
		break;
	case LogicalTypeId::UINTEGER:
		ripdb_compat::FlatVecMutable<uint32_t>(vec)[row_idx] = static_cast<uint32_t>(cell.u64);
		break;
	case LogicalTypeId::BIGINT:
	case LogicalTypeId::TIMESTAMP:
	case LogicalTypeId::TIMESTAMP_TZ:
	case LogicalTypeId::TIMESTAMP_SEC:
	case LogicalTypeId::TIMESTAMP_MS:
	case LogicalTypeId::TIMESTAMP_NS:
	case LogicalTypeId::TIME:
	case LogicalTypeId::TIME_NS:
		ripdb_compat::FlatVecMutable<int64_t>(vec)[row_idx] = cell.i64;
		break;
	case LogicalTypeId::UBIGINT:
	case LogicalTypeId::TIME_TZ:
		// TIME_TZ on the wire is u64; DuckDB's physical type is also a packed
		// 64-bit value (dtime_tz_t wrapping uint64). Storing the raw u64 is
		// the same byte sequence DuckDB expects.
		ripdb_compat::FlatVecMutable<uint64_t>(vec)[row_idx] = cell.u64;
		break;
	case LogicalTypeId::FLOAT: {
		uint32_t bits = cell.f32bits;
		float f;
		std::memcpy(&f, &bits, sizeof(f));
		ripdb_compat::FlatVecMutable<float>(vec)[row_idx] = f;
		break;
	}
	case LogicalTypeId::DOUBLE: {
		uint64_t bits = cell.f64bits;
		double d;
		std::memcpy(&d, &bits, sizeof(d));
		ripdb_compat::FlatVecMutable<double>(vec)[row_idx] = d;
		break;
	}
	case LogicalTypeId::HUGEINT:
	case LogicalTypeId::UUID: {
		// Both physically stored as hugeint_t (16 bytes lo + hi).
		auto *out = ripdb_compat::FlatVecMutable<hugeint_t>(vec);
		out[row_idx].lower = cell.i128.lo;
		out[row_idx].upper = cell.i128.hi;
		break;
	}
	case LogicalTypeId::UHUGEINT: {
		auto *out = ripdb_compat::FlatVecMutable<uhugeint_t>(vec);
		out[row_idx].lower = cell.u128.lo;
		out[row_idx].upper = cell.u128.hi;
		break;
	}
	case LogicalTypeId::INTERVAL: {
		auto *out = ripdb_compat::FlatVecMutable<interval_t>(vec);
		out[row_idx].months = cell.iv.months;
		out[row_idx].days   = cell.iv.days;
		out[row_idx].micros = cell.iv.micros;
		break;
	}
	case LogicalTypeId::VARCHAR: {
		auto *out = ripdb_compat::FlatVecMutable<string_t>(vec);
		out[row_idx] = StringVector::AddString(vec, cell.bytes.data(), cell.bytes.size());
		break;
	}
	case LogicalTypeId::DECIMAL: {
		// DECIMAL's physical storage depends on width: INT16 / INT32 /
		// INT64 / INT128. The decoder picked the matching Cell tag
		// (I16/I32/I64/I128V) based on the wire width, and the catalog
		// built a LogicalType::DECIMAL(w, s) whose InternalType() lines
		// up with that — so we dispatch on the physical type and copy
		// the unscaled integer straight through.
		auto phys = type.InternalType();
		switch (phys) {
		case PhysicalType::INT16:
			ripdb_compat::FlatVecMutable<int16_t>(vec)[row_idx] = static_cast<int16_t>(cell.i64);
			break;
		case PhysicalType::INT32:
			ripdb_compat::FlatVecMutable<int32_t>(vec)[row_idx] = static_cast<int32_t>(cell.i64);
			break;
		case PhysicalType::INT64:
			ripdb_compat::FlatVecMutable<int64_t>(vec)[row_idx] = cell.i64;
			break;
		case PhysicalType::INT128: {
			auto *out = ripdb_compat::FlatVecMutable<hugeint_t>(vec);
			out[row_idx].lower = cell.i128.lo;
			out[row_idx].upper = cell.i128.hi;
			break;
		}
		default:
			throw NotImplementedException(
			    "ripdb: DECIMAL physical type %s not supported",
			    TypeIdToString(phys));
		}
		break;
	}
	default:
		throw NotImplementedException(
		    "ripdb: writing column type '%s' to output vector is not yet implemented",
		    type.ToString());
	}
}

static void RipScanFunction(ClientContext &, TableFunctionInput &input, DataChunk &output) {
	auto &state = input.global_state->Cast<RipScanGlobalState>();
	if (!state.decoded) {
		output.SetCardinality(0);
		return;
	}

	const auto &chunks = state.decoded->success.chunks;
	idx_t out_row = 0;
	const idx_t cap = STANDARD_VECTOR_SIZE;

	while (out_row < cap && state.chunk_cursor < chunks.size()) {
		const auto &chunk = chunks[state.chunk_cursor];
		while (out_row < cap && state.row_cursor < chunk.rowCount) {
			for (idx_t col = 0; col < state.out_cols.size(); ++col) {
				const auto &oc = state.out_cols[col];
				if (oc.remote_idx == RipScanGlobalState::ROWID_SLOT) {
					// Synthetic sequential rowid. DuckDB doesn't rely on these
					// values being stable across queries, only that they're
					// unique within a scan, which they are.
					ripdb_compat::FlatVecMutable<int64_t>(output.data[col])[out_row] =
					    state.emitted_rows + static_cast<int64_t>(out_row);
				} else {
					const auto &cell = chunk.columns[oc.decoded_idx][state.row_cursor];
					WriteCellToVector(output.data[col], out_row, cell);
				}
			}
			++out_row;
			++state.row_cursor;
		}
		if (state.row_cursor >= chunk.rowCount) {
			++state.chunk_cursor;
			state.row_cursor = 0;
		}
	}

	state.emitted_rows += static_cast<int64_t>(out_row);
	output.SetCardinality(out_row);
}

// ---------------------------------------------------------------------------
// RipTransaction / RipTransactionManager — minimum-viable no-ops.
// ---------------------------------------------------------------------------

class RipTransaction : public Transaction {
public:
	RipTransaction(TransactionManager &mgr, ClientContext &ctx) : Transaction(mgr, ctx) {
	}
};

class RipTransactionManager : public TransactionManager {
public:
	explicit RipTransactionManager(AttachedDatabase &db) : TransactionManager(db) {
	}

	Transaction &StartTransaction(ClientContext &context) override {
		auto txn = make_uniq<RipTransaction>(*this, context);
		auto &ref = *txn;
		std::lock_guard<std::mutex> lock(txn_mutex_);
		transactions_.push_back(std::move(txn));
		return ref;
	}

	ErrorData CommitTransaction(ClientContext &, Transaction &transaction) override {
		std::lock_guard<std::mutex> lock(txn_mutex_);
		EraseLocked(transaction);
		return ErrorData {};
	}

	void RollbackTransaction(Transaction &transaction) override {
		std::lock_guard<std::mutex> lock(txn_mutex_);
		EraseLocked(transaction);
	}

	void Checkpoint(ClientContext &, bool /*force*/) override {
		// Read-only catalog; nothing to flush.
	}

private:
	void EraseLocked(Transaction &transaction) {
		for (auto it = transactions_.begin(); it != transactions_.end(); ++it) {
			if (it->get() == &transaction) {
				transactions_.erase(it);
				return;
			}
		}
	}

	std::mutex                       txn_mutex_;
	vector<unique_ptr<RipTransaction>> transactions_;
};

// ---------------------------------------------------------------------------
// rip_refresh(catalog_name) — table function that re-queries the remote
// /tables + /schema/:t endpoints for an already-attached ripdb catalog and
// atomically swaps in a fresh RipSchemaEntry. Returns one row of stats.
//
// Usage:
//   CALL rip_refresh('rip');                    -- CALL syntax (table func)
//   SELECT * FROM rip_refresh('rip');           -- equivalent
//   -- → (catalog VARCHAR, tables_loaded BIGINT, tables_refused BIGINT)
//
// Semantics:
//   - The catalog pointer swap invalidates any optional_ptr<CatalogEntry>
//     the binder may have cached from prior queries. Since rip_refresh
//     runs at a query boundary, in-flight scans retain their bind data
//     (which is self-contained — see RipScanBindData); subsequent queries
//     re-bind and see the new schema.
//   - This is cooperative, not transactional: if refresh throws midway
//     (e.g. remote /tables endpoint fails), the old schema is untouched.
// ---------------------------------------------------------------------------

struct RipRefreshBindData : public TableFunctionData {
	string           catalog_name;
	RipRefreshStats  stats;
	RipRefreshBindData(string n, RipRefreshStats s)
	    : catalog_name(std::move(n)), stats(s) {}
};

struct RipRefreshGlobalState : public GlobalTableFunctionState {
	bool emitted = false;
	idx_t MaxThreads() const override { return 1; }
};

static unique_ptr<FunctionData>
RipRefreshBind(ClientContext &context, TableFunctionBindInput &input,
               vector<LogicalType> &return_types, vector<string> &names) {
	if (input.inputs.size() != 1 || input.inputs[0].IsNull()) {
		throw BinderException(
		    "rip_refresh: requires one VARCHAR argument, the attached catalog name");
	}
	auto catalog_name = input.inputs[0].ToString();

	auto &db_mgr = DatabaseManager::Get(context);
	auto attached = db_mgr.GetDatabase(context, catalog_name);
	if (!attached) {
		throw CatalogException("rip_refresh: no attached database named '%s'", catalog_name);
	}
	auto &cat = attached->GetCatalog();
	if (cat.GetCatalogType() != "ripdb") {
		throw InvalidInputException(
		    "rip_refresh: '%s' is not a ripdb catalog (type: '%s')",
		    catalog_name, cat.GetCatalogType());
	}
	auto &rip_cat = cat.Cast<RipCatalog>();
	auto stats = rip_cat.Refresh();

	return_types = {LogicalType::VARCHAR, LogicalType::BIGINT, LogicalType::BIGINT};
	names        = {"catalog", "tables_loaded", "tables_refused"};
	return make_uniq<RipRefreshBindData>(std::move(catalog_name), stats);
}

static unique_ptr<GlobalTableFunctionState>
RipRefreshInitGlobal(ClientContext &, TableFunctionInitInput &) {
	return make_uniq<RipRefreshGlobalState>();
}

static void RipRefreshFunction(ClientContext &, TableFunctionInput &input, DataChunk &output) {
	auto &state = input.global_state->Cast<RipRefreshGlobalState>();
	if (state.emitted) {
		output.SetCardinality(0);
		return;
	}
	auto &bd = input.bind_data->Cast<RipRefreshBindData>();

	auto *names_out = ripdb_compat::FlatVecMutable<string_t>(output.data[0]);
	names_out[0]    = StringVector::AddString(output.data[0], bd.catalog_name);
	ripdb_compat::FlatVecMutable<int64_t>(output.data[1])[0] = bd.stats.loaded;
	ripdb_compat::FlatVecMutable<int64_t>(output.data[2])[0] = bd.stats.refused;
	output.SetCardinality(1);
	state.emitted = true;
}

static TableFunction MakeRipRefreshFunction() {
	TableFunction fn("rip_refresh", {LogicalType::VARCHAR},
	                  RipRefreshFunction, RipRefreshBind, RipRefreshInitGlobal);
	return fn;
}

// ---------------------------------------------------------------------------
// Storage extension entry points + Load.
// ---------------------------------------------------------------------------

static unique_ptr<Catalog> RipAttach(optional_ptr<StorageExtensionInfo>, ClientContext &,
                                      AttachedDatabase &db, const string &, AttachInfo &info,
                                      AttachOptions &options) {
	RipConnOptions opts;
	opts.base_url = NormalizeUrl(info.path);
	if (opts.base_url.empty()) {
		throw InvalidInputException(
		    "ripdb: ATTACH requires a URL, e.g. ATTACH 'http://localhost:4213' AS r (TYPE ripdb)");
	}

	// Optional per-attach options (timeout for now; auth/etc deferred).
	auto it = options.options.find("timeout_seconds");
	if (it != options.options.end() && !it->second.IsNull()) {
		auto v = it->second.GetValue<int64_t>();
		if (v > 0) opts.timeout_seconds = static_cast<uint64_t>(v);
	}

	return make_uniq<RipCatalog>(db, std::move(opts));
}

static unique_ptr<TransactionManager> RipCreateTxnMgr(optional_ptr<StorageExtensionInfo>,
                                                       AttachedDatabase &db, Catalog &) {
	return make_uniq<RipTransactionManager>(db);
}

// Exposed (not static) so Phase 2A's in-process driver can call it directly
// without going through dlopen/LOAD. The DUCKDB_CPP_EXTENSION_ENTRY below is
// the standard on-disk-extension entry for Phase 2B.
void Load(ExtensionLoader &loader) {
	auto &db = loader.GetDatabaseInstance();
	auto &config = DBConfig::GetConfig(db);
	auto ext = make_shared_ptr<StorageExtension>();
	ext->attach = RipAttach;
	ext->create_transaction_manager = RipCreateTxnMgr;
	StorageExtension::Register(config, "ripdb", std::move(ext));

	loader.RegisterFunction(MakeRipRefreshFunction());
}

} // namespace ripdb
} // namespace duckdb

extern "C" {

DUCKDB_CPP_EXTENSION_ENTRY(ripdb, loader) {
	duckdb::ripdb::Load(loader);
}
}
