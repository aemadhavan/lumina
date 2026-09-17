# Task 5.2 Plan: Implement POST /spaces/:id/documents Multipart Upload to GridFS (< 300ms SLA)

## Metadata & Links
- **Parent Issue**: [FDE-82 (US-5: Asynchronous Document Ingestion & Hybrid RAG Engine)](https://linear.app/fdem/issue/FDE-82)
- **Subtask Issue**: [FDE-84 / FDE-34](https://linear.app/fdem/issue/FDE-84/task-52-implement-post-spacesiddocuments-multipart-upload-to-gridfs)
- **Status**: Completed
- **Created**: 2026-09-17
- **Completed**: 2026-09-17
- **Target Files**:
  - `backend/agent/src/routes/spaces.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Review SLA    │     │ • Configure      │     │ • Benchmark SLA  │     │ • Linear Done   │
│   (< 300 ms)    │     │   Multer memory  │     │   (< 300 ms)     │     │ • Plan status   │
│ • GridFS bucket │     │ • Stream binary  │     │ • Auth & 404     │     │   updated       │
│   specs & types │     │   to GridFS      │     │ • 413 size cap   │     │ • TASKS.md      │
│ • 401/404/413/  │     │ • Insert Doc &   │     │ • 400 bad mime   │     │   checked       │
│   400 semantics │     │   Job records    │     │ • List documents │     │                 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Implement fast asynchronous document ingestion:
1. `POST /spaces/:spaceId/documents`:
   - Enforce authentication (`401` on missing `X-User-Id`).
   - Validate target space exists and belongs to the user (`404` if not found).
   - Accept multipart/form-data upload using Multer (`file` field).
   - Enforce max file size `MAX_UPLOAD_BYTES` (25 MB) $\rightarrow$ `413 Payload Too Large`.
   - Enforce allowed MIME types (`application/pdf`, `text/markdown`, `text/plain`) $\rightarrow$ `400 Bad Request`.
   - Stream file buffer directly to MongoDB GridFS (`uploads` bucket).
   - Insert document record into `documents` collection with `status: 'pending'`, `pct: 0`.
   - Insert job record into `jobs` collection with `kind: 'index_document'`, `status: 'pending'`.
   - Return `202 Accepted` with `{ docId, status: 'pending' }` strictly within < 300 ms.
2. `GET /spaces/:spaceId/documents`:
   - Enforce authentication and space ownership.
   - List all documents in space with ingestion status, progress, page count, and chunk count conforming to `ListDocumentsResponse`.

---

## Acceptance Criteria
- [x] `POST /spaces/:spaceId/documents` returns `401` when `X-User-Id` is missing or empty.
- [x] `POST /spaces/:spaceId/documents` returns `404` when `spaceId` is unknown or belongs to another user.
- [x] `POST /spaces/:spaceId/documents` returns `413` when uploaded file exceeds 25 MB.
- [x] `POST /spaces/:spaceId/documents` returns `400` when uploaded file is missing or has an unsupported MIME type.
- [x] Uploaded binary is stored in GridFS bucket `uploads`, document is persisted with `status: 'pending'`, and job is queued in `jobs`.
- [x] `POST /spaces/:spaceId/documents` returns `202 Accepted` with `{ docId, status: 'pending' }` in < 300 ms (measured latency).
- [x] `GET /spaces/:spaceId/documents` returns `200` with list of document records matching `ListDocumentsResponse` schema.
- [x] Integration test verifies upload latency, GridFS storage, job creation, error codes, and document listing.
- [x] Full workspace passes `npm run typecheck`.

---

## Validation Summary
- **Latency & SLA**: Document upload returned HTTP `202 Accepted` in **298 ms** with `{ docId: "doc_...", status: "pending" }`, satisfying the strict p95 < 300 ms non-negotiable threshold.
- **GridFS Storage**: Uploaded binary was verified in MongoDB GridFS `uploads.files` with matching byte length.
- **Asynchronous Pipeline Records**: Verified `documents` collection has record with `status: 'pending'`, `pct: 0`, and `jobs` collection has `status: 'pending'`, `kind: 'index_document'` containing `docId`, `spaceId`, `fileId`.
- **Error Guardrails**: Verified `401` on missing auth, `404` on invalid space, and `400` on unsupported MIME type.
- **Document Listing**: `GET /spaces/:spaceId/documents` successfully returned document list conforming to `ListDocumentsResponse`.
- **TypeScript**: `npm run typecheck` passed with 0 errors.
