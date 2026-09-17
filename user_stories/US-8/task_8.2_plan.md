# Task 8.2 Plan: Run quality checks (node quality/check.mjs .) ensuring zero errors

## Metadata & Links
- **Parent Issue**: [FDE-102 (US-8: Automated Quality Gates)](https://linear.app/fdem/issue/FDE-102)
- **Subtask Issue**: [FDE-104](https://linear.app/fdem/issue/FDE-104)
- **Status**: Completed
- **Created**: 2026-09-17
- **Target Files**:
  - `runs/*.json`
  - `quality/check.mjs` (read-only execution)

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Inspect runs/ │     │ • Run quality    │     │ • Verify 0 errors│     │ • Linear Done   │
│   directory     │     │   check script   │     │   reported       │     │ • Plan status   │
│ • Ensure failed │     │ • Inspect all    │     │ • Check all A/B/R│     │   updated       │
│   runs in       │     │   rules output   │     │   rules pass     │     │ • Ready for 8.3 │
│   runs/failing/ │     │                  │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Execute the quality checker against all run logs in `runs/`:
1. Run `node quality/check.mjs .`
2. Ensure:
   - Rule A1 passes: all tool calls with `ok: false` have a non-empty error string.
   - Rule A2 passes: every run in `runs/` has `terminated: 'done'`.
   - Rule A3 passes: no tool thrash ($> 3$ consecutive calls of the same tool).
   - Rule R1 & R2 pass: required tools called, forbidden tools never called.
   - Rule B1, B2, B3 pass: token, wall-clock, and cost budgets respected.

---

## Acceptance Criteria
- [x] `node quality/check.mjs .` reports 0 errors across 549 runs.
- [x] No run in `runs/` terminates with anything other than `'done'`.
