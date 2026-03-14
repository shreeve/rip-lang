# Scheduler Policy (M0b)

This document freezes v1 scheduler behavior.

## Algorithm

v1 uses **least-inflight** per app pool.

Selection order:
1. filter to workers in `ready` state
2. choose worker with lowest `inflight`
3. tie-break by lowest `workerId`

## Fallback behavior

- If all workers are saturated and queue depth `< maxQueue`: enqueue
- If queue depth `>= maxQueue`: return `503` with `Retry-After`

## Fairness expectations

- No worker starvation under steady load
- No worker starvation under burst load
- Workload spread should converge over time for equal worker capacity

## Retry policy interaction

- Retry only idempotent requests by default
- Never retry after partial upstream response
- Retry decisions occur after scheduler selection and only on retry-eligible failures

## Metrics emitted

- per-app scheduler decisions
- per-worker inflight counts
- queue depth and queue wait duration
- shed count (`503` due to capacity)

## Change criteria (v2)

Consider upgrading algorithm if:
- tail latency variance between workers > 3x for sustained periods
- workload variance causes persistent imbalance despite least-inflight

Candidate future algorithms:
- EWMA latency-weighted
- power-of-two choices
