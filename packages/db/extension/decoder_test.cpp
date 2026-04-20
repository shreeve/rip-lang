// ============================================================================
// decoder_test.cpp — Golden-test harness for the standalone rip-db decoder.
//
// Walks packages/db/extension/test/fixtures/ and, for each `.bin` file:
//   * `.golden` sibling exists -> decode the bin, render canonical text,
//                                  compare byte-for-byte against .golden.
//   * `.reject` sibling exists -> decode the bin; the decode must throw,
//                                  and the exception message must contain the
//                                  substring declared on the first line of
//                                  the .reject file.
//
// Prints a per-fixture PASS/FAIL line and a final summary. Exit code 0 iff
// every fixture passes.
//
// No DuckDB dependency, no JSON parser, no external libraries — just libc++
// and <filesystem>. Build with `./build.sh`.
// ============================================================================

#include "decoder.h"

#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

namespace fs = std::filesystem;

static std::vector<uint8_t> read_bin(const fs::path& p) {
  std::ifstream f(p, std::ios::binary);
  if (!f) {
    std::fprintf(stderr, "cannot open %s\n", p.c_str());
    std::exit(2);
  }
  std::vector<uint8_t> bytes((std::istreambuf_iterator<char>(f)),
                              std::istreambuf_iterator<char>());
  return bytes;
}

static std::string read_text(const fs::path& p) {
  std::ifstream f(p, std::ios::binary);
  if (!f) {
    std::fprintf(stderr, "cannot open %s\n", p.c_str());
    std::exit(2);
  }
  std::string s((std::istreambuf_iterator<char>(f)),
                std::istreambuf_iterator<char>());
  return s;
}

struct TestStats {
  size_t total   = 0;
  size_t passed  = 0;
  std::vector<std::string> failures;
};

// Show the first divergence between two strings as a contextual diff, to
// make golden mismatches actionable without a visual diff tool.
static std::string first_diff_context(const std::string& a, const std::string& b) {
  size_t i = 0;
  size_t n = std::min(a.size(), b.size());
  while (i < n && a[i] == b[i]) ++i;
  if (i == a.size() && i == b.size()) return "(identical)";

  auto line_of = [](const std::string& s, size_t off) {
    size_t line = 1;
    size_t col  = 1;
    for (size_t k = 0; k < off && k < s.size(); ++k) {
      if (s[k] == '\n') { ++line; col = 1; } else { ++col; }
    }
    char buf[64];
    std::snprintf(buf, sizeof(buf), "line %zu col %zu", line, col);
    return std::string(buf);
  };

  auto window = [&](const std::string& s, size_t off) {
    size_t start = off > 60 ? off - 60 : 0;
    size_t end   = std::min(s.size(), off + 60);
    std::string snippet = s.substr(start, end - start);
    for (char& c : snippet) {
      if (c == '\n') c = '/';  // single-line preview
    }
    return snippet;
  };

  std::string out;
  out += "  first divergence at ";
  out += line_of(a, i);
  out += " (byte " + std::to_string(i) + ")\n";
  out += "    expected: " + window(a, i) + "\n";
  out += "    actual  : " + window(b, i) + "\n";
  return out;
}

static void run_success(const fs::path& bin, const fs::path& golden, TestStats& s) {
  ++s.total;
  std::string            rel      = fs::relative(bin).string();
  std::vector<uint8_t>   body     = read_bin(bin);
  std::string            expected = read_text(golden);

  try {
    ripdb::DecodedResult r      = ripdb::decode(body.data(), body.size());
    std::string          actual = ripdb::renderGolden(r);
    if (actual == expected) {
      ++s.passed;
      std::printf("PASS  %s\n", rel.c_str());
    } else {
      std::string msg = "FAIL  " + rel + "\n" + first_diff_context(expected, actual);
      std::printf("%s", msg.c_str());
      s.failures.push_back(rel + " (golden mismatch)");
    }
  } catch (const std::exception& e) {
    std::printf("FAIL  %s — threw: %s\n", rel.c_str(), e.what());
    s.failures.push_back(rel + std::string(" (threw: ") + e.what() + ")");
  }
}

// Parse a very small subset of the .info file format: any line of the form
// `<key>: <value>` where key is one of `expected_rows`, `expected_cols`,
// `chunks`, or `source`. Whitespace-tolerant.
struct InfoAssertion {
  long expected_rows  = -1;  // -1 = not asserted
  long expected_cols  = -1;
  long chunks         = -1;
  std::string source;
};

static InfoAssertion parse_info(const std::string& text) {
  InfoAssertion a;
  std::string   line;
  auto          flush = [&](const std::string& l) {
    size_t colon = l.find(':');
    if (colon == std::string::npos) return;
    std::string key = l.substr(0, colon);
    std::string val = l.substr(colon + 1);
    auto trim = [](std::string& s) {
      while (!s.empty() && (s.front() == ' ' || s.front() == '\t')) s.erase(s.begin());
      while (!s.empty() && (s.back() == ' '  || s.back() == '\t' || s.back() == '\r' || s.back() == '\n')) s.pop_back();
    };
    trim(key); trim(val);
    if      (key == "expected_rows") a.expected_rows = std::strtol(val.c_str(), nullptr, 10);
    else if (key == "expected_cols") a.expected_cols = std::strtol(val.c_str(), nullptr, 10);
    else if (key == "chunks")        a.chunks        = std::strtol(val.c_str(), nullptr, 10);
    else if (key == "source")        a.source        = val;
  };
  for (char c : text) {
    if (c == '\n') { flush(line); line.clear(); }
    else line.push_back(c);
  }
  if (!line.empty()) flush(line);
  return a;
}

static void run_integration(const fs::path& bin, const fs::path& info_file, TestStats& s) {
  ++s.total;
  std::string rel = fs::relative(bin).string();

  std::vector<uint8_t> body = read_bin(bin);
  std::string          info = read_text(info_file);
  InfoAssertion        a    = parse_info(info);

  try {
    ripdb::DecodedResult r = ripdb::decode(body.data(), body.size());
    if (r.isError) {
      std::printf("FAIL  %s — decoded as error envelope: %s\n",
                  rel.c_str(), r.error.message.c_str());
      s.failures.push_back(rel + " (server returned error)");
      return;
    }
    long total_rows = 0;
    for (const auto& ch : r.success.chunks) total_rows += ch.rowCount;
    long cols   = (long)r.success.columns.size();
    long chunks = (long)r.success.chunks.size();

    auto check = [&](const char* name, long got, long want) {
      if (want < 0) return true;
      if (got == want) return true;
      std::printf("FAIL  %s — %s mismatch: got %ld, want %ld\n", rel.c_str(), name, got, want);
      s.failures.push_back(rel + " (" + name + " mismatch)");
      return false;
    };

    bool ok = true;
    ok &= check("expected_rows", total_rows, a.expected_rows);
    ok &= check("expected_cols", cols,       a.expected_cols);
    ok &= check("chunks",        chunks,     a.chunks);
    if (ok) {
      ++s.passed;
      std::printf("PASS  %s — %ld rows, %ld cols, %ld chunks\n",
                  rel.c_str(), total_rows, cols, chunks);
    }
  } catch (const std::exception& e) {
    std::printf("FAIL  %s — threw: %s\n", rel.c_str(), e.what());
    s.failures.push_back(rel + std::string(" (threw: ") + e.what() + ")");
  }
}

static void run_malformed(const fs::path& bin, const fs::path& reject_file, TestStats& s) {
  ++s.total;
  std::string rel  = fs::relative(bin).string();

  std::string reject = read_text(reject_file);
  // .reject file's first line is the required-substring of the thrown message.
  std::string needle;
  for (char c : reject) {
    if (c == '\n' || c == '\r') break;
    needle.push_back(c);
  }
  std::vector<uint8_t> body = read_bin(bin);

  try {
    ripdb::DecodedResult r = ripdb::decode(body.data(), body.size());
    (void)r;
    std::printf("FAIL  %s — expected rejection containing \"%s\", but decode succeeded\n",
                rel.c_str(), needle.c_str());
    s.failures.push_back(rel + " (expected rejection, got success)");
  } catch (const std::exception& e) {
    std::string got = e.what();
    if (got.find(needle) != std::string::npos) {
      ++s.passed;
      std::printf("PASS  %s — rejected: %s\n", rel.c_str(), got.c_str());
    } else {
      std::printf("FAIL  %s — rejected but wrong message\n"
                  "       expected substring: %s\n"
                  "       got:                %s\n",
                  rel.c_str(), needle.c_str(), got.c_str());
      s.failures.push_back(rel + " (wrong rejection message)");
    }
  }
}

int main(int argc, char** argv) {
  fs::path fixtures_root;
  if (argc > 1) {
    fixtures_root = argv[1];
  } else {
    // Default: sibling directory of this binary.
    fs::path self = fs::path(argv[0]).parent_path();
    fixtures_root = self / "test" / "fixtures";
    if (!fs::exists(fixtures_root)) {
      // Fallback: run from repo root.
      fixtures_root = "packages/db/extension/test/fixtures";
    }
  }

  if (!fs::exists(fixtures_root)) {
    std::fprintf(stderr, "fixtures root not found: %s\n", fixtures_root.c_str());
    return 2;
  }

  std::printf("# ripdb decoder golden tests\n");
  std::printf("# fixtures root: %s\n", fs::absolute(fixtures_root).c_str());

  // Collect all .bin files deterministically.
  std::vector<fs::path> bins;
  for (auto& e : fs::recursive_directory_iterator(fixtures_root)) {
    if (!e.is_regular_file()) continue;
    if (e.path().extension() == ".bin") bins.push_back(e.path());
  }
  std::sort(bins.begin(), bins.end());

  TestStats s;
  for (const auto& bin : bins) {
    fs::path golden = bin;  golden.replace_extension(".golden");
    fs::path reject = bin;  reject.replace_extension(".reject");
    fs::path info   = bin;  info.replace_extension(".info");
    if      (fs::exists(golden)) run_success    (bin, golden, s);
    else if (fs::exists(reject)) run_malformed  (bin, reject, s);
    else if (fs::exists(info))   run_integration(bin, info,   s);
    else {
      std::printf("SKIP  %s (no .golden, .reject, or .info sibling)\n",
                  fs::relative(bin).string().c_str());
    }
  }

  std::printf("\n# %zu / %zu passed\n", s.passed, s.total);
  if (!s.failures.empty()) {
    std::printf("# failures:\n");
    for (const auto& f : s.failures) std::printf("#   %s\n", f.c_str());
    return 1;
  }
  return 0;
}
