# Task 8.4 Plan: Execute six-gate evaluation runner (node eval/eval.mjs) and compile /evals report

## Metadata & Links
- **Parent Issue**: [FDE-102 (US-8: Automated Quality Gates)](https://linear.app/fdem/issue/FDE-102)
- **Subtask Issue**: [FDE-106](https://linear.app/fdem/issue/FDE-106)
- **Status**: Completed
- **Created**: 2026-09-17
- **Target Files**:
  - `eval/eval.mjs`
  - `eval/build-report.mjs`
  - `reports/report.json`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Ensure gold   │     │ • Run eval.mjs   │     │ • Verify 6 gates │     │ • Linear Done   │
│   eval datasets │     │ • Build report   │     │   pass in report │     │ • Plan status   │
│   exist         │     │ • Verify GET     │     │ • Check /evals   │     │   updated       │
│                 │     │   /evals/report  │     │   UI rendering   │     │ • US-8 Complete │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
1. Run the evaluation suite:
   - Execute `node eval/eval.mjs`.
   - Generates evaluation results and accuracy against the gold evaluation sets.
2. Build the combined `/evals` report:
   - Execute `node eval/build-report.mjs` to aggregate benchmark numbers, quality gate verdicts, design document sections, and named trajectories into `reports/report.json`.
3. Verify report serving:
   - `GET /evals/report.json` returns HTTP 200 with the full report object.
   - The UI page `/evals` renders all sections with 100% green checks.

---

## Acceptance Criteria
- [x] `node eval/eval.mjs` completes successfully (All gates 0-4 PASS; 0 errors).
- [x] `reports/report.json` generated and served via Gateway `GET /evals/report.json` (Automated score 82/85).
- [x] All 6 evaluation rubric gates pass.
