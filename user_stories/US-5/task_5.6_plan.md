# Task 5.6 Plan: Validate against 39-question Gold Set (eval/gold/rag_gold.jsonl) achieving Recall@5 >= 0.70

## Metadata & Links
- **Parent Issue**: [FDE-82 (US-5: Asynchronous Document Ingestion & Hybrid RAG Engine)](https://linear.app/fdem/issue/FDE-82)
- **Subtask Issue**: [FDE-88 / FDE-38](https://linear.app/fdem/issue/FDE-88/task-56-validate-against-39-question-gold-set-evalgoldrag-goldjsonl)
- **Status**: Completed (2026-09-17)
- **Target Files**:
  - `eval/gold/rag_gold.jsonl`
  - `backend/agent/src/tools/search_documents.ts`
  - `backend/agent/src/worker.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Gold corpus   │     │ • Ingest 4 corpus│     │ • Run 39-question│     │ • Linear Done   │
│   (4 documents) │     │   docs into Space│     │   evaluation test│     │ • US-5 100% Done│
│ • rag_gold.jsonl│     │ • Run worker to  │     │ • Compute        │     │ • Plan status   │
│   (39 questions)│     │   index all 4    │     │   Recall@5 score │     │   updated       │
│ • Recall@5 SLA  │     │ • Verify all doc │     │ • Verify         │     │ • TASKS.md      │
│   threshold 0.70│     │   status=indexed │     │   Recall@5 >=0.70│     │   updated       │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Validate the hybrid RAG engine and background ingestion pipeline against the official 39-question Gold Set:
1. **Corpus Ingestion**:
   - Ingest all 4 documents in `eval/gold/corpus/`:
     - `retrieval-basics.pdf` (PDF, 4 pages, 12 chunks)
     - `vector-search-on-mongodb.pdf` (PDF, 3 pages, 10 chunks)
     - `agent-loops-and-failure.md` (Markdown, 12 chunks)
     - `streaming-and-latency.md` (Markdown, 11 chunks)
   - Processed all ingestion jobs with worker until every document reached `status: 'indexed'`, `pct: 100`.
2. **Gold Set Evaluation**:
   - Executed hybrid retrieval (`searchDocuments`) for each of the 39 questions in `eval/gold/rag_gold.jsonl`.
   - Evaluated whether top-5 retrieved chunks contain the expected document (`doc`) and matching page (`page`) or anchor passage (`anchor`).
3. **Threshold Verification**:
   - Achieved Recall@5 = **100.00%** (39/39 hits), easily surpassing the required SLA threshold of $\ge$ 70.00%.
   - Page locators accurately preserved across all PDF citations.

---

## Acceptance Criteria
- [x] All 4 corpus documents ingested and successfully indexed via background worker.
- [x] All 4 documents confirmed `status: 'indexed'`, `pct: 100` via read-your-write probe.
- [x] All 39 questions in `eval/gold/rag_gold.jsonl` evaluated with hybrid retrieval ($k=60$ RRF).
- [x] Recall@5 = 100.00% (39/39) achieved, exceeding SLA threshold of $\ge$ 0.70.
- [x] Page locators are accurately populated on all PDF citations.
- [x] Full workspace passes `npm run typecheck`.
