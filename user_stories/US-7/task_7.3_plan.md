# Task 7.3 Plan: Implement Zod schema validation using @lumina/contract (400 on bad payload)

## Metadata & Links
- **Parent Issue**: [FDE-95 (US-7: Edge Gateway)](https://linear.app/fdem/issue/FDE-95)
- **Subtask Issue**: [FDE-98](https://linear.app/fdem/issue/FDE-98)
- **Status**: Completed
- **Created**: 2026-09-17
- **Target Files**:
  - `backend/gateway/src/index.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Schemas:      │     │ • Validate bodies│     │ • Test empty body│     │ • Linear Done   │
│   AskBody,      │     │   against Zod    │     │   returns 400    │     │ • Plan status   │
│   CreateThread, │     │ • Return 400 with│     │ • Test invalid   │     │   updated       │
│   CreateSpace   │     │   issue details  │     │   field returns  │     │ • 0 type errors │
│                 │     │                  │     │   400 with msg   │     │ • Ready for 7.4 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
1. Validate inbound request payloads at the Gateway before reaching upstream:
   - `POST /threads/:threadId/ask`: validate against `AskBody`.
   - `POST /threads`: validate against `CreateThreadBody`.
   - `POST /spaces`: validate against `CreateSpaceBody`.
2. Error Handling:
   - If validation fails, immediately return HTTP `400 Bad Request`.
   - JSON response: `{ error: issue.message, status: 400, requestId }`.

---

## Acceptance Criteria
- [x] `POST /threads/:id/ask` with empty or invalid body returns 400 Bad Request.
- [x] Valid bodies pass validation and proceed downstream.
- [x] Full workspace passes `npm run typecheck`.
