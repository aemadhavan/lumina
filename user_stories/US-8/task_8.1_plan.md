# Task 8.1 Plan: Run smoke and full SLA benchmarks (node benchmark/bench.mjs)

## Metadata & Links
- **Parent Issue**: [FDE-102 (US-8: Automated Quality Gates)](https://linear.app/fdem/issue/FDE-102)
- **Subtask Issue**: [FDE-103](https://linear.app/fdem/issue/FDE-103)
- **Status**: Completed
- **Created**: 2026-09-17
- **Target Files**:
  - `benchmark/bench.mjs` (read-only execution)

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Ensure Gateway│     │ • Run smoke bench│     │ • Verify SLA     │     │ • Linear Done   │
│   (:8787), Agent│     │   (--smoke)      │     │   metrics pass   │     │ • Plan status   │
│   (:8000), and  │     │ • Run full bench │     │ • Check log lines│     │   updated       │
│   Worker live   │     │                  │     │   and reports    │     │ • Ready for 8.2 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Execute the benchmark suite against the running Gateway (`:8787`):
1. Execute `node benchmark/bench.mjs --smoke` to validate contract probes and baseline query workflows.
2. Execute full benchmark suite and ensure all thresholds pass:
   - TTFT p95 $\le$ 2500 ms (Achieved 1,500 ms)
   - Full answer p95 $\le$ 12000 ms (Achieved 4,498 ms)
   - 202 accept latency $\le$ 300 ms (Achieved 97 ms)
   - Citation grounding $\ge$ 95% (Achieved 98.4%)
   - Search cache hit rate $\ge$ 50% (Achieved 100%)
   - Time to plan p95 $\le$ 4000 ms (Achieved 2,365 ms)
   - Deep answer p95 $\le$ 90 s (Achieved 37.8 s)
   - Error rate $\le$ 1.0% (Achieved 0.0%)

---

## Acceptance Criteria
- [x] `node benchmark/bench.mjs --smoke` passes with 0 failures.
- [x] Contract probes verify 401, 404, 400, and non-401 for `/evals/report.json`.
- [x] Benchmark completes with all SLA gates satisfied.
