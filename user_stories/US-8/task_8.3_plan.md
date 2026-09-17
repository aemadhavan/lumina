# Task 8.3 Plan: Capture valid run in runs/ and deliberate failing trajectory in runs/failing/ (Rule P1)

## Metadata & Links
- **Parent Issue**: [FDE-102 (US-8: Automated Quality Gates)](https://linear.app/fdem/issue/FDE-102)
- **Subtask Issue**: [FDE-105](https://linear.app/fdem/issue/FDE-105)
- **Status**: Completed
- **Created**: 2026-09-17
- **Target Files**:
  - `runs/*.json`
  - `runs/failing/*.json`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Rule P1 & A2  │     │ • Generate valid │     │ • Check runs/ has│     │ • Linear Done   │
│   co-existence  │     │   run in runs/   │     │   only 'done'    │     │ • Plan status   │
│ • Failing run in│     │ • Trigger failing│     │ • Check failing/ │     │   updated       │
│   runs/failing/ │     │   run in failing/│     │   has 'error'    │     │ • Ready for 8.4 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Fulfill grading Rule P1 and Rule A2 simultaneously:
1. "Keep a deliberately failed run in `runs/failing/`, not `runs/`. Rule A2 grades every run in `runs/` and fails one that did not terminate as `done`; rule P1 requires you to keep a failing trajectory. The subfolder is how both hold at once — the trajectory rules read `runs/*.json` only, and `eval/build-report.mjs` reads both." (AGENTS.md)
2. Generate a valid, clean query run in `runs/<requestId>.json` with `terminated: "done"` (e.g. `req_00dab7ae-9ff.json`).
3. Generate a deliberate failure stored in `runs/failing/<requestId>.json` with `terminated: "error"` (e.g. `req_failing_sample.json`).
4. Document the exact request IDs of both trajectories for the `/evals` report.

---

## Acceptance Criteria
- [x] At least one valid run in `runs/` with `terminated: "done"` (captured `req_00dab7ae-9ff.json`).
- [x] At least one failing run in `runs/failing/` with `terminated: "error"` (captured `req_failing_sample.json`).
- [x] Both trajectories strictly validate against the `RunLog` contract schema.
