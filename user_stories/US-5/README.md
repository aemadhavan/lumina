# User Story 5 (US-5): Asynchronous Document Ingestion & Hybrid RAG Engine

**Linear Reference**: [FDE-82](https://linear.app/fdem/issue/FDE-82) / [FDE-9](https://linear.app/fdem/issue/FDE-9)  
**Parent Project**: LUMINA  
**Status**: Completed (2026-09-17)  

---

## 1. Subtasks & Implementation Status

| Linear Issue | Task Name | Status | Plan & Evidence |
| :--- | :--- | :--- | :--- |
| [FDE-83 / FDE-33](https://linear.app/fdem/issue/FDE-83) | Task 5.1: Implement Spaces management endpoints (`/spaces`) | Completed | [task_5.1_plan.md](task_5.1_plan.md) |
| [FDE-84 / FDE-34](https://linear.app/fdem/issue/FDE-84) | Task 5.2: Implement `POST /spaces/:id/documents` multipart upload to GridFS returning 202 in < 300ms | Completed | [task_5.2_plan.md](task_5.2_plan.md) |
| [FDE-85 / FDE-35](https://linear.app/fdem/issue/FDE-85) | Task 5.3: Implement background jobs worker (`backend/agent/src/worker.ts`) for PDF parsing, chunking, and embedding | Completed | [task_5.3_plan.md](task_5.3_plan.md) |
| [FDE-86 / FDE-36](https://linear.app/fdem/issue/FDE-86) | Task 5.4: Implement read-your-write probe to verify vector search readiness before marking document indexed | Completed | [task_5.4_plan.md](task_5.4_plan.md) |
| [FDE-87 / FDE-37](https://linear.app/fdem/issue/FDE-87) | Task 5.5: Implement hybrid search fusion (`$vectorSearch` + `$search` via RRF) with page locators (`p. N`) | Completed | [task_5.5_plan.md](task_5.5_plan.md) |
| [FDE-88 / FDE-38](https://linear.app/fdem/issue/FDE-88) | Task 5.6: Validate against 39-question Gold Set (`eval/gold/rag_gold.jsonl`) achieving Recall@5 >= 0.70 | Completed | [task_5.6_plan.md](task_5.6_plan.md) |

---

## 2. Key Architecture & Deliverables

- **Spaces & Documents API (`routes/spaces.ts`)**:
  - `POST /spaces`: Creates a space partitioned by `userId`.
  - `GET /spaces`: Lists spaces for the authenticated user.
  - `GET /spaces/:spaceId/documents`: Lists documents and their ingestion status (`pending`, `parsing`, `embedding`, `indexed`, `failed`).
  - `POST /spaces/:spaceId/documents`: Accepts multipart/form-data upload, stores raw binary in MongoDB GridFS, records pending document & job row, returning `202 Accepted` in < 300 ms.
- **Asynchronous Jobs Worker (`backend/agent/src/worker.ts`)**:
  - Long-running polling worker with crash-safe lease claiming (`status: running`, `claimedAt`).
  - Stale lease sweeper resetting abandoned jobs back to `pending`.
  - Extracts text and exact page numbers using `pdfjs-dist` (or markdown/plain text).
  - Chunks into semantic passages preserving `{ page }` or `{ heading }` locators.
  - Batch embeddings via OpenAI `text-embedding-3-small`.
  - Atomically writes chunks into `chunks` collection with `spaceId` and `userId`.
- **Read-Your-Write Probe**:
  - Document remains in `embedding` stage until a read-your-write vector probe (`$vectorSearch` on index `chunks_vector` with `filter: { spaceId }`) successfully returns one of its chunks.
  - Transitions document to `indexed` only after searchable verification.
- **Hybrid RAG Engine (`search_documents` tool)**:
  - Fuses Atlas Vector Search (`$vectorSearch`) and Atlas Full-Text Search (`$search`) using Reciprocal Rank Fusion (RRF).
  - Emits sources with `kind: "doc"`, title, docId, and exact locator (e.g. `p. 4`).
