# Task 5.4 Plan: Implement Read-Your-Write Probe for Vector Search Verification

## Metadata & Links
- **Parent Issue**: [FDE-82 (US-5: Asynchronous Document Ingestion & Hybrid RAG Engine)](https://linear.app/fdem/issue/FDE-82)
- **Subtask Issue**: [FDE-86 / FDE-36](https://linear.app/fdem/issue/FDE-86/task-54-implement-read-your-write-probe-to-verify-vector-search)
- **Status**: Completed (2026-09-17)
- **Target Files**:
  - `backend/agent/src/worker.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Contract &    │     │ • Implement      │     │ • Upload PDF &   │     │ • Linear Done   │
│   SPEC probe    │     │   probeReadYour- │     │   run worker     │     │ • Plan status   │
│   requirements  │     │   Write function │     │ • Verify probe   │     │   updated       │
│ • Atlas index   │     │ • Poll $vector-  │     │   polls & passes │     │ • TASKS.md      │
│   chunks_vector │     │   Search index   │     │ • Verify doc     │     │   checked       │
│ • SLA & backoff │     │ • Transition to  │     │   status is now  │     │ • 0 type errors │
│                 │     │   status:indexed │     │   "indexed" 100% │     │                 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Implement the read-your-write probe in the worker to verify that upserted chunks are genuinely searchable in the MongoDB Atlas Vector Search index before marking a document `indexed`:
1. **Probe Logic (`probeReadYourWrite`)**:
   - Queries `$vectorSearch` against index `chunks_vector` with `path: 'embedding'`, `queryVector`, and filter `spaceId`.
   - Polls at 500ms intervals up to 30s timeout until the vector search index returns the newly written chunk.
2. **State Transition**:
   - Transition document to `status: 'indexed'`, `pct: 100` **only after** the probe confirms the chunk is returned from the index.
   - If probe times out, document transitions to `status: 'failed'`.
3. **Compliance**:
   - Conforms to the core invariant: *"A document becomes `indexed` only after a read-your-write probe returns one of its chunks from the vector index. 'Upserted' is not 'searchable'."*

---

## Acceptance Criteria
- [x] `probeReadYourWrite` executes `$vectorSearch` against `chunks_vector` filtered by `spaceId`.
- [x] Worker polls until the probe returns the target chunk from the vector index.
- [x] Document transitions to `status: 'indexed'` and `pct: 100` only after probe success.
- [x] If probe times out, document is marked `status: 'failed'`.
- [x] Integration test verifies the entire pipeline from file upload through worker execution and read-your-write probe confirmation (`elapsedMs: 1193ms`, 12 chunks indexed).
- [x] Full workspace passes `npm run typecheck`.
