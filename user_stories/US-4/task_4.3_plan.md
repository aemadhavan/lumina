# Task 4.3 Plan: Implement REST Endpoints (GET /memory, DELETE /memory/:id)

## Metadata & Links
- **Parent Issue**: [FDE-77 (US-4: Semantic Long-Term Memory System)](https://linear.app/fdem/issue/FDE-77)
- **Subtask Issue**: [FDE-80 / FDE-31](https://linear.app/fdem/issue/FDE-80/task-43-implement-rest-endpoints-get-memory-delete-memoryid)
- **Status**: Completed
- **Created**: 2026-09-16
- **Completed**: 2026-09-16
- **Target Files**:
  - `backend/agent/src/routes/memory.ts`
  - `backend/agent/src/index.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Contract &    │     │ • Create router  │     │ • Auth check     │     │ • Linear Done   │
│   SPEC review   │     │   routes/memory  │     │   (401)          │     │ • Plan status   │
│ • Zod schemas   │     │ • Mount router   │     │ • List memories  │     │   updated       │
│ • 401/404/204   │     │   in agent index │     │   (200)          │     │ • TASKS.md      │
│   semantics     │     │ • Exclude 501s   │     │ • Delete (204)   │     │   checked       │
│                 │     │                  │     │ • 404 on missing │     │                 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Implement Express REST handlers for memory management in the agent service:
1. `GET /memory`: Retrieve all saved memories for the authenticated user (`X-User-Id`), sorted chronologically descending. Validates output structure against `ListMemoryResponse` from `@lumina/contract`.
2. `DELETE /memory/:memoryId`: Atomically delete the memory document belonging to `X-User-Id`. Returns `204 No Content` on success or `404 Not Found` if the memory ID does not exist for that user.
3. Both endpoints require strict authentication (`401` on missing or empty `X-User-Id`).

---

## Acceptance Criteria
- [x] `GET /memory` returns `401` when `X-User-Id` header is missing or empty.
- [x] `GET /memory` queries MongoDB `memories` collection filtered by `userId`, returns `200` with `{ memories: [...] }`.
- [x] Each memory object in `GET /memory` conforms to `Memory` schema (`id`, `text`, optional `sourceThread`, `createdAt`).
- [x] `DELETE /memory/:memoryId` returns `401` when `X-User-Id` header is missing or empty.
- [x] `DELETE /memory/:memoryId` deletes the document matching `_id: memoryId` and `userId: userId`, returning `204 No Content`.
- [x] `DELETE /memory/:memoryId` returns `404 Not Found` when attempting to delete a non-existent or other user's memory.
- [x] `backend/agent/src/index.ts` mounts `memoryRouter` and skips `/memory` from the `notImplemented` 501 catch-all loop.
- [x] Endpoints verified with live functional tests and full TypeScript typecheck.

---

## Validation Summary
- **Auth Enforcement**: Verified missing `x-user-id` returns `401` for both `GET /memory` and `DELETE /memory/:id`.
- **List Retrieval**: Successfully retrieved empty list `[]` and populated list containing saved memories matching `ListMemoryResponse` schema.
- **Tenant Isolation**: Verified attempt by User B to delete User A's memory returns `404 Not Found`.
- **Atomic Deletion**: Verified User A deleting memory returns `204 No Content`, subsequent `GET /memory` confirms absence, and subsequent `DELETE` returns `404 Not Found`.
- **Type Safety**: Full workspace `npm run typecheck` passed with 0 errors across all packages.
