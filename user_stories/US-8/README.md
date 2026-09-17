# User Story 8 (US-8): Automated Quality Gates, Trajectory Recording & Benchmarking

**Linear Reference**: [FDE-102](https://linear.app/fdem/issue/FDE-102) / [FDE-12](https://linear.app/fdem/issue/FDE-12)  
**Parent Project**: LUMINA  
**Status**: Completed  

---

## 1. Subtasks & Implementation Status

| Linear Issue | Task Name | Status | Plan & Evidence |
| :--- | :--- | :--- | :--- |
| [FDE-103](https://linear.app/fdem/issue/FDE-103) | Task 8.1: Run smoke and full SLA benchmarks (`node benchmark/bench.mjs`) ensuring all SLA metrics pass | Completed | [task_8.1_plan.md](task_8.1_plan.md) |
| [FDE-104](https://linear.app/fdem/issue/FDE-104) | Task 8.2: Run quality checks (`node quality/check.mjs .`) ensuring zero errors | Completed | [task_8.2_plan.md](task_8.2_plan.md) |
| [FDE-105](https://linear.app/fdem/issue/FDE-105) | Task 8.3: Capture valid run in `runs/` and deliberate failing trajectory in `runs/failing/` (Rule P1) | Completed | [task_8.3_plan.md](task_8.3_plan.md) |
| [FDE-106](https://linear.app/fdem/issue/FDE-106) | Task 8.4: Execute six-gate evaluation runner (`node eval/eval.mjs`) and compile `/evals` report | Completed | [task_8.4_plan.md](task_8.4_plan.md) |

---

## 2. Architecture & Deliverables

1. **Benchmark Suite Execution**:
   - Run `node benchmark/bench.mjs --smoke` against local gateway `:8787`.
   - Run full benchmark workload (`web_queries`, repeat cache hits, document gold queries, deep queries).
   - Meet SLA thresholds from `benchmark/sla.json`:
     - TTFT p95 $\le$ 2500 ms
     - Answer latency p95 $\le$ 12000 ms
     - Accept 202 p95 $\le$ 300 ms
     - Citation grounding $\ge$ 95%
     - Search cache hit rate $\ge$ 50%
     - Deep search time to plan p95 $\le$ 4000 ms
     - Deep search full answer p95 $\le$ 90 s
     - Error rate $\le$ 1.0%
2. **Quality Checker (`node quality/check.mjs .`)**:
   - Zero errors across all checks (`C1`, `A1`, `A2`, `A3`, `R1`, `R2`, `E1`, `E2`, `B1`, `B2`, `B3`).
   - Strict adherence to rule A1 (`ok: false` must carry error string) and rule A2 (`terminated: 'done'`).
3. **Dual Trajectory Capture (Rule P1)**:
   - Valid, successful trajectory in `runs/<requestId>.json`.
   - Deliberately failed trajectory in `runs/failing/<requestId>.json`.
4. **Six-Gate Evaluation Runner (`node eval/eval.mjs`)**:
   - Runs `eval/eval.mjs` against gold set and produces `reports/report.json` / `reports/eval.json`.
   - Served via `GET /evals/report.json` and rendered at `/evals`.
