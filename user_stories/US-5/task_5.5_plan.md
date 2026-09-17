# Task 5.5 Plan: Implement Hybrid Search Fusion ($vectorSearch + $search via RRF) with Page Locators

## Metadata & Links
- **Parent Issue**: [FDE-82 (US-5: Asynchronous Document Ingestion & Hybrid RAG Engine)](https://linear.app/fdem/issue/FDE-82)
- **Subtask Issue**: [FDE-87 / FDE-37](https://linear.app/fdem/issue/FDE-87/task-55-implement-hybrid-search-fusion-dollarvectorsearch-dollarsearch)
- **Status**: Completed (2026-09-17)
- **Target Files**:
  - `backend/agent/src/tools/search_documents.ts`
  - `backend/agent/src/tools/index.ts`
  - `backend/agent/src/loop.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Contract &    │     │ • Implement      │     │ • Unit/int tests │     │ • Linear Done   │
│   SPEC schemas  │     │   searchDocuments│     │   with vector +  │     │ • Plan status   │
│ • chunks_vector │     │ • $vectorSearch  │     │   text retrieval │     │   updated       │
│   & chunks_text │     │   + $search      │     │ • Verify RRF rank│     │ • TASKS.md      │
│ • RRF formula   │     │ • RRF rank fusion│     │   and page locator│     │   checked       │
│   k = 60        │     │ • Wire in loop.ts│     │ • 0 type errors  │     │ • Ready for 5.6 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Implement hybrid search fusion for document retrieval in `backend/agent/src/tools/search_documents.ts`:
1. **Hybrid Retrieval**:
   - **Vector Search**: Queries `$vectorSearch` on index `chunks_vector` with cosine similarity on `embedding` and `filter: { spaceId: { $eq: spaceId } }`.
   - **Text Search**: Queries `$search` on index `chunks_text` with BM25 text match on `text` and compound filter on `spaceId`. Gracefully handles fallback if text index is building.
2. **Reciprocal Rank Fusion (RRF)**:
   - Combine ranked lists using standard Cormack et al. formula:
     $$\text{RRF}(d) = \sum_{r \in \{\text{vector}, \text{text}\}} \frac{1}{60 + \text{rank}_r(d)}$$
   - Dedupes chunks by `_id`, sorts by descending combined RRF score, and returns top $K$ candidates (default 5).
3. **Citation & Locators**:
   - Formats citations conforming to contract `Source`:
     - `kind: 'doc'`
     - `title`: Document filename or title
     - `docId`: Unique document identifier
     - `snippet`: Chunk text
     - `locator`: `{ page: N }` for PDF, `{ heading }` for Markdown, or `{ line }` for text.
4. **Agent Loop Integration**:
   - Expose `search_documents` tool to `runQuickLoop`.
   - In `mode: 'docs'` or `mode: 'auto'` with `spaceId`, route search queries to `search_documents`.

---

## Acceptance Criteria
- [x] `search_documents` executes `$vectorSearch` on `chunks_vector` with `spaceId` filter.
- [x] `search_documents` executes `$search` on `chunks_text` with `spaceId` filter (with graceful fallback if indexing).
- [x] Results from both channels are fused using Reciprocal Rank Fusion ($k = 60$).
- [x] Each returned source has `kind: 'doc'`, document `title`, `docId`, and proper locator (`{ page: N }`).
- [x] `search_documents` is wired into the agent loop and called during `mode: 'docs'` or `mode: 'auto'` with `spaceId`.
- [x] Typecheck passes across all packages (`npm run typecheck`).
