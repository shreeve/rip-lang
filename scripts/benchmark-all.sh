#!/bin/bash

# Run all three benchmarks and show key metrics
# Perfect for before/after comparisons!

echo "=========================================="
echo "  Parser Performance - All Metrics"
echo "=========================================="
echo ""

echo "1️⃣  PARSING ACTIONS (table lookups)"
echo ""
bun run benchmark:actions 2>&1 | grep "Actions/sec:"
bun run benchmark:actions 2>&1 | grep "Time per action:"
echo ""

echo "2️⃣  PARSER ONLY (no lexer, no codegen)"
echo ""
bun run benchmark:parser 2>&1 | grep "Parses/sec:"
bun run benchmark:parser 2>&1 | grep "Average:" | tail -1
echo ""

echo "3️⃣  FULL COMPILATION (lexer + parser + codegen)"
echo ""
bun run benchmark 2>&1 | grep "Parses/sec:"
bun run benchmark 2>&1 | grep "Average:" | tail -1
echo ""

echo "=========================================="
echo "✓ Key Metrics Summary"
echo ""
echo "  Actions/sec: Primary optimization target"
echo "  Parser files/sec: Shows parser-only improvement"
echo "  Full compilation: Real-world user experience"
echo "=========================================="
