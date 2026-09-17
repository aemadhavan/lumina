# Task 5.1 Plan: Implement Spaces Management Endpoints (/spaces)

## Metadata & Links
- **Parent Issue**: [FDE-82 (US-5: Asynchronous Document Ingestion & Hybrid RAG Engine)](https://linear.app/fdem/issue/FDE-82)
- **Subtask Issue**: [FDE-83 / FDE-33](https://linear.app/fdem/issue/FDE-83/task-51-implement-spaces-management-endpoints-spaces)
- **Status**: Completed
- **Created**: 2026-09-17
- **Completed**: 2026-09-17
- **Target Files**:
  - `backend/agent/src/routes/spaces.ts`
  - `backend/agent/src/index.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Contract &    │     │ • Create router  │     │ • Auth check     │     │ • Linear Done   │
│   schemas review│     │   routes/spaces  │     │   (401)          │     │ • Plan status   │
│ • SpaceId &     │     │ • Mount router   │     │ • Create space   │     │   updated       │
│   SpaceDoc type │     │   in agent index │     │   (200)          │     │ • TASKS.md      │
│ • Validation &  │     │ • Exclude 501s   │     │ • List spaces    │     │   checked       │
│   auth rules    │     │   for /spaces    │     │   (200)          │     │ • Typecheck 0   │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Implement Express REST handlers for Spaces management in the agent service:
1. `POST /spaces`: Authenticates `X-User-Id`, validates body against `CreateSpaceBody` (`{ name: string }`), generates `spaceId` (`newId('spc')`), persists `SpaceDoc` to MongoDB `spaces` collection, and returns `200` with `CreateSpaceResponse` (`{ spaceId, name }`).
2. `GET /spaces`: Authenticates `X-User-Id`, retrieves all spaces for the authenticated user sorted by `createdAt: -1`, and returns `200` with `ListSpacesResponse` (`{ spaces: [{ spaceId, name, createdAt }] }`).
3. Enforce strict `401 Unauthorized` if `X-User-Id` is absent or empty.

---

## Acceptance Criteria
- [x] `POST /spaces` returns `401` when `X-User-Id` is missing or empty.
- [x] `POST /spaces` returns `400` when body is invalid (e.g. empty or too long name).
- [x] `POST /spaces` inserts `SpaceDoc` into MongoDB `spaces` collection with generated `spc_` prefix and returns `200 { spaceId, name }`.
- [x] `GET /spaces` returns `401` when `X-User-Id` is missing or empty.
- [x] `GET /spaces` returns `200 { spaces: [...] }` matching `ListSpacesResponse` contract schema, strictly isolated by `userId`.
- [x] `backend/agent/src/index.ts` mounts `spacesRouter` and skips `/spaces` from the `notImplemented` 501 loop.
- [x] Integration test verifies creation, listing, authentication, and tenant isolation.
- [x] `npm run typecheck` passes with 0 errors.

---

## Validation Summary
- **Authentication Guard**: Verified `401 Unauthorized` returned for both `POST /spaces` and `GET /spaces` when `X-User-Id` header is missing.
- **Request Validation**: Verified `400 Bad Request` returned when `name` is empty.
- **Creation & Schema**: Successfully created space `spc_mu468gbkythvo0` ("Architecture Specs") conforming to `CreateSpaceResponse`.
- **List & Isolation**: Verified `GET /spaces` returns the space for User A, while User B receives `[]` (strict tenant isolation).
- **Compilation**: Full workspace `npm run typecheck` passed with 0 errors.
