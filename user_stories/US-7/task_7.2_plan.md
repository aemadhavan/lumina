# Task 7.2 Plan: Implement X-Request-Id correlation and Pino structured logging

## Metadata & Links
- **Parent Issue**: [FDE-95 (US-7: Edge Gateway)](https://linear.app/fdem/issue/FDE-95)
- **Subtask Issue**: [FDE-97](https://linear.app/fdem/issue/FDE-97)
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
│ • Pino JSON spec│     │ • Extract/gen    │     │ • Verify header  │     │ • Linear Done   │
│   (method,route,│     │   X-Request-Id   │     │   in response    │     │ • Plan status   │
│   status,ms,etc)│     │ • Forward in HTTP│     │ • Verify log line│     │   updated       │
│ • Forward header│     │ • Configure pino │     │   matches spec   │     │ • 0 type errors │
│                 │     │                  │     │                  │     │ • Ready for 7.3 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
1. Handle `X-Request-Id`:
   - Reuse inbound `X-Request-Id` if provided.
   - Otherwise generate unique ID `req_${randomUUID().slice(0, 12)}`.
   - Set `X-Request-Id` in response header.
   - Forward `X-Request-Id` in all upstream fetch calls to Agent Service.
2. Structured Pino Logging:
   - Output structured JSON logs with: `method`, `route`, `status`, `ms`, `requestId`, `userId`.

---

## Acceptance Criteria
- [x] `X-Request-Id` is present on all responses.
- [x] Pino emits JSON log line per completed request with correlation metadata.
- [x] Upstream proxy calls carry `X-Request-Id`.
- [x] Full workspace passes `npm run typecheck`.
