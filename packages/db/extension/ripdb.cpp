// ============================================================================
// ripdb.cpp — DuckDB binding for a remote rip-db HTTP server.
//
// Commit 2 (M1) — see packages/db/CLI.md §"Implementation progress" for the
// running log of what's landed and what's deferred.
//
// Phase 2A scope (this file at first commit):
//   - Loadable-extension entrypoint via DUCKDB_CPP_EXTENSION_ENTRY.
//   - StorageExtension('ripdb') → ATTACH dispatch.
//   - RipCatalog + RipSchemaEntry + RipTableEntry, all read-only.
//   - Eager catalog population at attach time (one /tables + one /schema/:t
//     per table). Stable per-attach object identity so DuckDB's binder/
//     autocomplete can hold optional_ptrs without lifetime drama.
//   - RipHttpClient over DuckDB's HTTPUtil (depends on httpfs at runtime).
//   - Scan function with projection pushdown and single-threaded scan.
//     Decode uses the Commit 1 decoder; per-row writes into output vectors,
//     no memcpy fast paths anywhere yet.
//   - RipTransaction + RipTransactionManager as thin no-ops.
//   - All Plan*/CreateXxx/DropXxx/Alter throw PermissionException with a
//     clear "ripdb: read-only v1" message.
//
// Phase 2B (next commit) wires the metadata footer + smoke-tests with a
// stock `duckdb -unsigned` CLI and verifies the four completion forms.
//
// Sentinel handling per peer-AI round 6:
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
#include "duckdb/storage/database_size.hpp"
#include "duckdb/storage/table_storage_info.hpp"
#include "duckdb/main/extension_helper.hpp"
#include "duckdb/main/extension_install_info.hpp"
#include "duckdb/planner/operator/logical_get.hpp"
#include "duckdb/planner/expression.hpp"
#include "duckdb/planner/expression/bound_comparison_expression.hpp"
#include "duckdb/planner/expression/bound_conjunction_expression.hpp"
#include "duckdb/planner/expression/bound_operator_expression.hpp"
#include "duckdb/planner/expression/bound_columnref_expression.hpp"
#include "duckdb/planner/expression/bound_constant_expression.hpp"
#include "duckdb/common/types/value.hpp"
#include "duckdb/common/enums/expression_type.hpp"
#include "yyjson.hpp"

#include <cstring>
#include <cstdio>
#include <cerrno>
#include <cstdlib>

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

	string PostBinary(const string &path, const string &content_type, const string &body) {
		string req = "POST " + path + " HTTP/1.1\r\n"
		             "Host: " + options_.host + ":" + std::to_string(options_.port) + "\r\n"
		             "User-Agent: ripdb/0.1\r\n"
		             "Content-Type: " + content_type + "\r\n"
		             "Content-Length: " + std::to_string(body.size()) + "\r\n"
		             "Connection: close\r\n\r\n";
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
		r.refuse_reason = "BLOB columns are not supported by the ripdb extension in M1 "
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
	if (upper == "ENUM" || starts_with("LIST(") || upper == "LIST" ||
	    starts_with("STRUCT(") || upper == "STRUCT" || starts_with("MAP(") || upper == "MAP" ||
	    starts_with("UNION(") || upper == "UNION" || starts_with("ARRAY(") || upper == "ARRAY" ||
	    upper == "BIT" || upper == "BITSTRING" || upper == "JSON" || upper == "VARIANT" ||
	    upper == "GEOMETRY" || starts_with("VARCHAR") || starts_with("CHAR(")) {
		r.type = LogicalType::VARCHAR;
		return r;
	}

	// Unknown — also expose as VARCHAR. Better than crashing.
	r.type = LogicalType::VARCHAR;
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
	return fn;
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

	// Inline reimplementation of TableCatalogEntry::GetInfo — identical to
	// the stock DuckDB impl but lives in our .so so no external symbol is
	// needed. All accessed members (columns/constraints via protected,
	// catalog/schema/name/comment/tags/temporary/internal/dependencies via
	// public) resolve to the base-class member layout at compile time.
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

private:
	string remote_name_;
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

	// All Create*/DropEntry/Alter throw — read-only in M1.
	[[noreturn]] static void ReadOnly(const char *what) {
		throw PermissionException(
		    "ripdb: remote database attached read-only in M1 — %s is not supported", what);
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

	PhysicalOperator &PlanCreateTableAs(ClientContext &, PhysicalPlanGenerator &, LogicalCreateTable &, PhysicalOperator &) override {
		RipSchemaEntry::ReadOnly("CREATE TABLE AS");
	}
	PhysicalOperator &PlanInsert(ClientContext &, PhysicalPlanGenerator &, LogicalInsert &, optional_ptr<PhysicalOperator>) override {
		RipSchemaEntry::ReadOnly("INSERT");
	}
	PhysicalOperator &PlanDelete(ClientContext &, PhysicalPlanGenerator &, LogicalDelete &, PhysicalOperator &) override {
		RipSchemaEntry::ReadOnly("DELETE");
	}
	PhysicalOperator &PlanUpdate(ClientContext &, PhysicalPlanGenerator &, LogicalUpdate &, PhysicalOperator &) override {
		RipSchemaEntry::ReadOnly("UPDATE");
	}

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
		meta.columns.push_back({std::move(col_name), std::move(mapped.type)});
	}
	duckdb_yyjson::yyjson_doc_free(doc);
	return meta;
}

} // anonymous namespace

RipRefreshStats RipCatalog::PopulateSchema(RipSchemaEntry &schema) {
	RipRefreshStats stats;
	string tables_body = http_->GetText("/tables");
	auto names = ParseTablesResponse(tables_body);

	for (const auto &table_name : names) {
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

		CreateTableInfo info;
		info.catalog = GetName();
		info.schema  = "main";
		info.table   = meta.name;
		for (auto &col : meta.columns) {
			info.columns.AddColumn(ColumnDefinition(col.name, col.type));
		}
		auto table_entry = make_uniq<RipTableEntry>(*this, schema, info, meta.name);
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
	bind_data = make_uniq<RipScanBindData>(cat.Options().base_url, "main", remote_name_,
	                                        std::move(all_names), std::move(all_types));
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

	string body = http.PostBinary("/ddb/run", "text/plain", sql);
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
