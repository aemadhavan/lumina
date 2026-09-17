# Task 5.3 Plan: Implement Background Jobs Worker for Parsing, Chunking & Embedding

## Metadata & Links
- **Parent Issue**: [FDE-82 (US-5: Asynchronous Document Ingestion & Hybrid RAG Engine)](https://linear.app/fdem/issue/FDE-82)
- **Subtask Issue**: [FDE-85 / FDE-35](https://linear.app/fdem/issue/FDE-85/task-53-implement-background-jobs-worker-backendagentsrcworkerts-for)
- **Status**: Completed
- **Created**: 2026-09-17
- **Completed**: 2026-09-17
- **Target Files**:
  - `backend/agent/src/worker.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Contract &    │     │ • Build PDF/MD/  │     │ • Test parsing   │     │ • Linear Done   │
│   schemas review│     │   TXT parsers    │     │   on real files  │     │ • Plan status   │
│ • Atomic claim  │     │ • Semantic       │     │ • Test lease     │     │   updated       │
│   & sweeper     │     │   chunking       │     │   claim & sweep  │     │ • TASKS.md      │
│ • Locator specs │     │ • Batch embed &  │     │ • Test chunks    │     │   checked       │
│   (page/heading)│     │   write to DB    │     │   in MongoDB     │     │                 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Build the asynchronous jobs worker (`backend/agent/src/worker.ts`) to ingest queued documents:
1. **Queue Management**:
   - Atomic job claiming from `jobs` collection via `findOneAndUpdate` setting `status: 'running'`, `claimedAt`, and `workerId`.
   - Stale lease sweeper resetting abandoned/crashed running jobs (`claimedAt > 2 min old`) back to `pending`.
2. **File Processing**:
   - Downloads binary stream from GridFS `uploads` bucket using `fileId`.
   - PDF parsing: extracts page-by-page text using `pdfjs-dist/legacy/build/pdf.mjs` and tracks 1-based page numbers.
   - Markdown / Text parsing: extracts sections with headings (`{ heading: string }`) or line numbers (`{ line: number }`).
3. **Semantic Chunking**:
   - Chunks text into passages (500–1000 chars) respecting structural boundaries (headings, paragraphs, sentences).
   - Attaches strict locators: `{ page: number }` for PDF, `{ heading: string }` or `{ line: number }` for text/markdown.
4. **Embedding & Storage**:
   - Generates 1536-dimensional embeddings in batches via OpenAI `text-embedding-3-small`.
   - Stores chunk records in `chunks` collection (`docId, spaceId, userId, text, locator, ord, embedding`).
   - Updates document progress: `status: 'parsing'` $\rightarrow$ `status: 'embedding'`, sets `pages` and `chunks` counts.

---

## Acceptance Criteria
- [x] Worker atomically claims pending jobs (`findOneAndUpdate`) setting `status: 'running'`, `claimedAt`, and `workerId`.
- [x] Stale lease sweeper detects jobs running > 2 minutes without heartbeat and resets them to `pending`.
- [x] PDF parser extracts exact text per page using `pdfjs-dist/legacy/build/pdf.mjs` with 1-based page numbers.
- [x] Markdown / plain text parser extracts sections with headings or line locators.
- [x] Semantic chunker produces well-bounded passages (500–1000 chars) retaining `{ page: number }` or `{ heading: string }`.
- [x] Chunks are batch-embedded (1536 dims) and inserted into `chunks` collection with `spaceId` and `userId`.
- [x] Document record updates with `status: 'embedding'`, `pages: number`, `chunks: number`, and progress `pct`.
- [x] Full workspace passes `npm run typecheck`.

---

## Validation Summary
- **Atomic Claim**: Verified `claimNextJob('test-worker-alpha')` updates job status to `running`, records `claimedAt`, increments attempts, and assigns `workerId`.
- **Crash Recovery**: Artificially aged lease to 5 minutes and executed `sweepStaleJobs()`; confirmed job was returned to `pending` with cleared lease.
- **Markdown Ingestion**: Processed `eval/gold/corpus/agent-loops-and-failure.md`, successfully created 12 chunks with structural `{ heading }` locators and 1536-dimensional vectors.
- **PDF Ingestion & Page Tracking**: Processed `eval/gold/corpus/retrieval-basics.pdf`, extracted all 4 pages via `pdfjs-dist`, generated 12 chunks, and verified 100% of chunks carry exact `{ page: N }` locators matching pages 1–4.
- **Compilation**: `npm run typecheck` passed across all 4 packages with 0 errors.
