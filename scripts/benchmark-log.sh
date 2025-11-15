#!/bin/bash

# Log benchmark results with timestamp and git commit
# Usage: ./scripts/benchmark-log.sh

LOG_FILE="scripts/benchmark-results.log"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

echo "Running benchmark and logging results..."
echo ""
echo "========================================" | tee -a "$LOG_FILE"
echo "Timestamp: $TIMESTAMP" | tee -a "$LOG_FILE"
echo "Commit: $COMMIT ($BRANCH)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Run benchmark and capture output
bun run benchmark 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "Results logged to: $LOG_FILE"
