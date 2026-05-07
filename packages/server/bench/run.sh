#!/usr/bin/env bash
# bench/run.sh — load-test a Rip Server bench app and capture results.
#
# Assumes a server is already running with bench/index.rip on port 3000.
#
# Usage:
#   ./bench/run.sh <name>                      # defaults: /sleep?ms=50, n=10000, c=100
#   N=20000 C=200 PATH_=/sleep?ms=50 ./bench/run.sh <name>
#   PATH_=/ping  ./bench/run.sh <name>         # floor latency
#   PATH_=/cpu?ms=5 ./bench/run.sh <name>      # cpu-bound

set -euo pipefail

# oha v1.14 reads NO_COLOR from env but rejects the legacy "1" value.
# Clear it so a globally-set NO_COLOR doesn't break the harness.
unset NO_COLOR

NAME="${1:?usage: $0 <name>}"
PATH_="${PATH_:-/sleep?ms=50}"
N="${N:-10000}"
C="${C:-100}"
HOST="${HOST:-http://localhost:3000}"

ENDPOINT="$HOST$PATH_"
DIAG_URL="$HOST/diagnostics"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"

# --- Pre-flight ---------------------------------------------------------------
load1=$(uptime | sed 's/.*load averages: //' | awk '{print $1}')
free_pages=$(vm_stat | awk '/Pages free/ {gsub(/\./,"",$3); print $3}')
free_gb=$(awk -v p="$free_pages" 'BEGIN { printf "%.1f", p * 16384 / 1073741824 }')

echo "=== Bench: $NAME ==="
echo "Endpoint: $ENDPOINT"
echo "Total: $N requests, Concurrency: $C"
echo "Pre-flight: load1=$load1, free=${free_gb}GB"

# Confirm server is up
if ! curl -sf -o /dev/null "$HOST/status"; then
  echo "ERROR: server not responding at $HOST/status" >&2
  exit 1
fi
echo

# --- Reset metrics by recording a baseline snapshot ---------------------------
diag_before=$(curl -s "$DIAG_URL" 2>/dev/null || echo '{}')
req_before=$(echo "$diag_before"     | jq -r '.metrics.requests          // 0')
ok_before=$(echo "$diag_before"      | jq -r '.metrics.responses["2xx"]  // 0')
err_before=$(echo "$diag_before"     | jq -r '.metrics.responses["5xx"]  // 0')
queued_before=$(echo "$diag_before"  | jq -r '.metrics.queue.queued      // 0')
shed_before=$(echo "$diag_before"    | jq -r '.metrics.queue.shed        // 0')
timeout_before=$(echo "$diag_before" | jq -r '.metrics.queue.timeouts    // 0')

# --- Warmup -------------------------------------------------------------------
echo "Warmup (500 requests, c=20)..."
oha -n 500 -c 20 --no-tui "$ENDPOINT" >/dev/null
sleep 1

# --- Real run -----------------------------------------------------------------
echo "Running ($N requests, c=$C)..."
out_file="$RESULTS_DIR/$NAME.txt"
oha -n "$N" -c "$C" --no-tui "$ENDPOINT" | tee "$out_file"

# --- Server-side delta --------------------------------------------------------
diag_after=$(curl -s "$DIAG_URL" 2>/dev/null || echo '{}')
req_after=$(echo "$diag_after"     | jq -r '.metrics.requests          // 0')
ok_after=$(echo "$diag_after"      | jq -r '.metrics.responses["2xx"]  // 0')
err_after=$(echo "$diag_after"     | jq -r '.metrics.responses["5xx"]  // 0')
queued_after=$(echo "$diag_after"  | jq -r '.metrics.queue.queued      // 0')
shed_after=$(echo "$diag_after"    | jq -r '.metrics.queue.shed        // 0')
timeout_after=$(echo "$diag_after" | jq -r '.metrics.queue.timeouts    // 0')

req_d=$((req_after - req_before))
ok_d=$((ok_after - ok_before))
err_d=$((err_after - err_before))
queued_d=$((queued_after - queued_before))
shed_d=$((shed_after - shed_before))
timeout_d=$((timeout_after - timeout_before))

cat > "$RESULTS_DIR/$NAME.diag.json" <<EOF
{
  "name": "$NAME",
  "endpoint": "$ENDPOINT",
  "requests": $req_d,
  "responses_2xx": $ok_d,
  "responses_5xx": $err_d,
  "queued": $queued_d,
  "queueShed": $shed_d,
  "queueTimeouts": $timeout_d,
  "load1_at_start": "$load1",
  "free_gb_at_start": "$free_gb"
}
EOF

echo
echo "=== Server-side counters (delta over this run) ==="
printf "  requests:       %d\n" "$req_d"
printf "  responses 2xx:  %d\n" "$ok_d"
printf "  responses 5xx:  %d\n" "$err_d"
printf "  queued:         %d\n" "$queued_d"
printf "  queueShed:      %d\n" "$shed_d"
printf "  queueTimeouts:  %d\n" "$timeout_d"
echo
echo "Results saved: $out_file + $RESULTS_DIR/$NAME.diag.json"
