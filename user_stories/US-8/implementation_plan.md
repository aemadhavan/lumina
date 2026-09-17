# User Story 8 Implementation Plan: Automated Quality Gates, Trajectory Recording & Benchmarking

## 1. Overview
User Story 8 executes the benchmark and quality verification pipeline to validate that LUMINA satisfies all contract rules, SLA latencies, grounding rates, cache efficiency, and budget caps declared in `benchmark/sla.json`, `expectations.json`, and `eval/rubric.json`.

---

## 2. Sequence of Execution

### Step 1: Services Preparation
- Ensure Background Worker (`backend/agent/src/worker.ts`), Agent Service (`backend/agent/src/index.ts` on `:8000`), and Gateway Service (`backend/gateway/src/index.ts` on `:8787`) are up and running cleanly.

### Step 2: Smoke Benchmark (`Task 8.1 / FDE-103`)
- Command: `node benchmark/bench.mjs --smoke`
- Verifies:
  - Contract probes (401, 404, 400, 200).
  - Health check endpoint names required components.
  - Basic web search, memory save/recall, and document indexing flow.

### Step 3: Full Benchmark (`Task 8.1 / FDE-103`)
- Command: `node benchmark/bench.mjs`
- Verifies all SLA thresholds:
  - TTFT p95 $\le$ 2500 ms
  - Quick answer p95 $\le$ 12000 ms
  - 202 accept latency $\le$ 300 ms
  - Grounding rate $\ge$ 95%
  - Cache hit rate $\ge$ 50%
  - Deep search plan time $\le$ 4000 ms
  - Deep search answer $\le$ 90 s
  - Deep source ratio $\ge$ 2.0x
  - Error rate $\le$ 1.0%

### Step 4: Quality Checker (`Task 8.2 / FDE-104`)
- Command: `node quality/check.mjs .`
- Verifies all run logs in `runs/*.json`:
  - Rule C1: declared expectations coherent.
  - Rule A1: tool calls with `ok: false` have error strings.
  - Rule A2: all runs in `runs/` terminate with `done`.
  - Rule A3: no consecutive tool thrash $> 3$.
  - Rule R1: required tools called.
  - Rule R2: forbidden tools (`plan_research` in quick) never called.
  - Rule B1/B2/B3: token, time, and cost budgets respected.

### Step 5: Trajectory Recording (Rule P1) (`Task 8.3 / FDE-105`)
- Retain successful runs in `runs/<requestId>.json`.
- Produce and store a deliberately failed trajectory in `runs/failing/<requestId>.json` (e.g. invalid provider key or service exception yielding 502 with `terminated: "error"`).

### Step 6: Six-Gate Evaluation Runner (`Task 8.4 / FDE-106`)
- Command: `node eval/eval.mjs`
- Generates `reports/eval.json` and compiles `reports/report.json` via `eval/build-report.mjs`.
- Verifies `GET /evals/report.json` serves the report to the UI.
