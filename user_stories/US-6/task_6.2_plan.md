# Task 6.2 Plan: Stream plan event prior to any retrieval; strictly ban quick runs from plan_research

## Metadata & Links
- **Parent Issue**: [FDE-89 (US-6: Deep Search & Spend Gate)](https://linear.app/fdem/issue/FDE-89)
- **Subtask Issue**: [FDE-91](https://linear.app/fdem/issue/FDE-91)
- **Status**: Completed
- **Created**: 2026-09-17
- **Target Files**:
  - `backend/agent/src/deep_loop.ts`
  - `backend/agent/src/routes/threads.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Contract SSE  │     │ • Implement      │     │ • Live deep run  │     │ • Linear Done   │
│   order: plan   │     │   runDeepLoop()  │     │ • Verify plan    │     │ • Plan status   │
│   must come 1st │     │ • onPlan callback│     │   event is first │     │   updated       │
│ • Quick guard:  │     │ • Strict check in│     │ • Verify quick   │     │ • 0 type errors │
│   never call    │     │   quick loop     │     │   run has no plan│     │ • Ready for 6.3 │
│   plan_research │     │                  │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
1. Implement Deep Search harness (`backend/agent/src/deep_loop.ts`).
2. When `depth: "deep"` is requested:
   - Call `planResearch({ query })`.
   - Immediately emit the `plan` SSE event **before any retrieval or search tool is invoked**.
3. Quick-search red-line enforcement:
   - `plan_research` is never made available in `runQuickLoop`.
   - The server never automatically escalates a quick search to deep.

---

## Acceptance Criteria
- [x] `plan` event is emitted as the very first SSE event in deep search mode.
- [x] No retrieval tools (`web_search`, `search_documents`, `fetch_page`) are called prior to `plan`.
- [x] Quick searches never execute `plan_research` or emit a `plan` event.
- [x] Full workspace passes `npm run typecheck`.
