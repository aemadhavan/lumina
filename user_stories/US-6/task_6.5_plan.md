# Task 6.5 Plan: Deep search budget caps (24 tools, 240s, $0.35) and source ratio validation

## Metadata & Links
- **Parent Issue**: [FDE-89 (US-6: Deep Search & Spend Gate)](https://linear.app/fdem/issue/FDE-89)
- **Subtask Issue**: [FDE-94](https://linear.app/fdem/issue/FDE-94)
- **Status**: Completed
- **Created**: 2026-09-17
- **Target Files**:
  - `backend/agent/src/deep_loop.ts`
  - `scratch/test_deep_search.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • SLA caps:     │     │ • Enforce 24     │     │ • Verify live run│     │ • Linear Done   │
│   24 tools,     │     │   tools & 240s   │     │   ratio >= 2.0x  │     │ • Plan status   │
│   240s, $0.35   │     │ • Terminate with │     │ • Verify cap ends│     │   updated       │
│ • min 2.0x ratio│     │   cap & partial  │     │   with partial   │     │ • 0 type errors │
│   vs quick      │     │   answer         │     │ • Cost within cap│     │ • US-6 Complete │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
1. Enforce deep search hard budget caps in `backend/agent/src/deep_loop.ts`:
   - Maximum 24 tool calls.
   - Maximum 240 seconds wall-clock time.
   - Graceful termination with `terminated: "cap"` and honest partial synthesis.
2. Verify deep vs. quick source ratio SLA:
   - Deep search must surface at least `min_deep_source_ratio` (2.0x) distinct sources compared to quick search on the same query.
3. Validate cost controls:
   - Cost stays within SLA `$0.35` per deep answer.

---

## Acceptance Criteria
- [x] Hard cap of 24 tool calls enforced in deep research loop.
- [x] Hard cap of 240s wall-clock time enforced.
- [x] Run terminated at cap reports `terminated: "cap"`.
- [x] Deep search achieves $\ge 2.0\times$ distinct sources over quick search baseline (verified 3.00x in `test_deep_search.ts`).
- [x] Full workspace passes `npm run typecheck`.
