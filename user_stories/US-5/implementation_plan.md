# Implementation Plan: US-5 Asynchronous Document Ingestion & Hybrid RAG Engine

**Parent Issue**: [US-5: Asynchronous Document Ingestion & Hybrid RAG Engine](https://linear.app/fdem/issue/FDE-82)  
**Related Linear Issues**: [FDE-9](https://linear.app/fdem/issue/FDE-9), [FDE-33](https://linear.app/fdem/issue/FDE-33) through [FDE-38](https://linear.app/fdem/issue/FDE-38), [FDE-83](https://linear.app/fdem/issue/FDE-83) through [FDE-88](https://linear.app/fdem/issue/FDE-88)  
**Status**: In Progress  
**Goal**: Build document Spaces, rapid 202 async upload to GridFS, a crash-safe background jobs worker for PDF/MD/TXT parsing and embedding, a read-your-write probe to confirm indexability, and hybrid search fusing vector and text search with page-level citation locators, achieving Recall@5 >= 0.70 on the gold evaluation set.

---

## 1. Subtask Execution Roadmap

```
user_stories/US-5/
├── Task 5.1 (FDE-83 / FDE-33): Implement Spaces management endpoints (/spaces)
├── Task 5.2 (FDE-84 / FDE-34): Implement POST /spaces/:id/documents multipart upload to GridFS returning 202 in < 300ms
├── Task 5.3 (FDE-85 / FDE-35): Implement background jobs worker (backend/agent/src/worker.ts) for PDF parsing, chunking, and embedding
├── Task 5.4 (FDE-86 / FDE-36): Implement read-your-write probe to verify vector search readiness before marking document indexed
├── Task 5.5 (FDE-87 / FDE-37): Implement hybrid search fusion ($vectorSearch + $search via RRF) with page locators (p. N)
└── Task 5.6 (FDE-88 / FDE-38): Validate against 39-question Gold Set (eval/gold/rag_gold.jsonl) achieving Recall@5 >= 0.70
```

---

## 2. Technical Architecture & Component Design

### Component 1: Spaces REST Endpoints (`backend/agent/src/routes/spaces.ts`)
- **`POST /spaces`**:
  - Validates `X-User-Id` header (401 on missing).
  - Validates body against `CreateSpaceBody` (`{ name: string }`).
  - Generates `spaceId` (`newId('spc')`).
  - Persists `SpaceDoc` to `spaces` collection.
  - Returns `200` with `CreateSpaceResponse` (`{ spaceId, name }`).
- **`GET /spaces`**:
  - Lists all spaces belonging to `userId` sorted by `createdAt: -1`.
  - Returns `200` with `ListSpacesResponse` (`{ spaces: [{ spaceId, name, createdAt }] }`).

### Component 2: Document Upload to GridFS (`backend/agent/src/routes/spaces.ts`)
- **`POST /spaces/:spaceId/documents`**:
  - Accepts `multipart/form-data` with multer memory storage.
  - Enforces `MAX_UPLOAD_BYTES` (25 MB) and `ACCEPTED_UPLOAD_TYPES` (`application/pdf`, `text/markdown`, `text/plain`).
  - Stores binary stream directly into MongoDB GridFS bucket (`uploads`).
  - Inserts `DocumentDoc` with `status: 'pending'`, `pct: 0`.
  - Inserts `JobDoc` with `kind: 'index_document'`, `status: 'pending'`.
  - Returns `202 Accepted` with `{ docId, status: 'pending' }` within SLA (< 300 ms).
- **`GET /spaces/:spaceId/documents`**:
  - Lists all documents for that space with status, progress `pct`, `pages`, `chunks`, and any error.
  - Returns `200` with `ListDocumentsResponse`.

### Component 3: Background Jobs Worker (`backend/agent/src/worker.ts`)
- Standalone worker process polling `jobs` collection for `status: 'pending'`.
- Atomic lease claiming via `findOneAndUpdate` setting `status: 'running'` and `claimedAt: new Date()`.
- Sweeper loop to reset stale leases (> 2 min) back to `pending`.
- Parses PDF using `pdfjs-dist` to extract per-page text and track page numbers.
- Semantic chunking (500–1000 chars) retaining `{ page: pageNum }` locators.
- Batch embedding with OpenAI `text-embedding-3-small`.
- Writes chunks to `chunks` collection with `spaceId`, `docId`, `userId`, `text`, `locator`, `embedding`.

### Component 4: Read-Your-Write Probe
- Before transitioning document status to `indexed`:
  - Worker performs a `$vectorSearch` against `chunks_vector` targeting one of the freshly inserted chunk embeddings with `filter: { spaceId }`.
  - Only when the probe successfully returns the chunk from the vector index is the document status updated to `indexed`.

### Component 5: Hybrid RAG Search (`search_documents` tool)
- Implements `searchDocuments({ spaceId, query, limit })`.
- Runs parallel queries:
  1. Vector search (`$vectorSearch` on `chunks_vector`).
  2. Full-text search (`$search` or text index).
- Combines using Reciprocal Rank Fusion (RRF: `score = 1 / (60 + rank)`).
- Emits citations with `kind: 'doc'`, document title, and exact locator (`p. 3`).

### Component 6: Gold Set Evaluation
- Ingests the 4 CC BY documents in `eval/gold/`.
- Executes evaluation against `eval/gold/rag_gold.jsonl`.
- Verifies Recall@5 >= 0.70.

---

## 3. Quality & Verification Gates
- `npm run typecheck` across all workspaces.
- `node quality/check.mjs .` passing with 0 errors.
