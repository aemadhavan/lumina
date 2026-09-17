# Task 6.3 Plan: Implement research fan-out, per-step subQuestion tagging, and merged contiguous citation numbering

## Metadata & Links
- **Parent Issue**: [FDE-89 (US-6: Deep Search & Spend Gate)](https://linear.app/fdem/issue/FDE-89)
- **Subtask Issue**: [FDE-92](https://linear.app/fdem/issue/FDE-92)
- **Status**: Completed
- **Created**: 2026-09-17
- **Target Files**:
  - `backend/agent/src/deep_loop.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • subQuestion   │     │ • Sub-question   │     │ • Verify trace   │     │ • Linear Done   │
│   tagging on    │     │   retrieval loop │     │   subQuestion tags│    │ • Plan status   │
│   trace & source│     │ • Tag every trace│     │ • Verify sources │     │   updated       │
│ • Unified       │     │   and source     │     │   subQuestion tags│    │ • 0 type errors │
│   deduplication │     │ • Contiguous     │     │ • Contiguous     │     │ • Ready for 6.4 │
│   [1..N] citations│   │   citations [1..N]│    │   1..N citations │     │                 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Implement research fan-out and structured synthesis in `backend/agent/src/deep_loop.ts`:
1. Iterate through each sub-question produced by `plan_research`.
2. For each sub-question:
   - Perform search (`web_search` or `search_documents`).
   - Fetch top pages via `fetch_page`.
   - Every `trace` event generated during this step must carry `subQuestion: sq.i`.
   - Every `source` item generated must carry `subQuestion: sq.i`.
3. Merge and deduplicate all sources:
   - Deduplicate web sources by URL.
   - Deduplicate doc sources by `docId` + locator.
   - Re-index all unique sources into a strictly contiguous sequence `[1..N]`.
4. Synthesize structured answer:
   - Includes direct summary, dedicated section for each sub-question, and remaining unknowns.
   - Every citation `[n]` in the text strictly maps to one unique source in `sources`.

---

## Acceptance Criteria
- [x] Every trace event on a deep run carries the `subQuestion` integer index it served.
- [x] Every source item carries its matching `subQuestion` integer index.
- [x] Sources are deduplicated and numbered contiguously from 1 to N without gaps.
- [x] Every `[n]` in the synthesized text resolves to exactly one entry in `sources`.
- [x] Answer is structured with a direct summary, sub-question sections, and open unknowns.
- [x] Full workspace passes `npm run typecheck`.
