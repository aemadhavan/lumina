# Task 7.4 Plan: Implement per-user rate limiting (429)

## Metadata & Links
- **Parent Issue**: [FDE-95 (US-7: Edge Gateway)](https://linear.app/fdem/issue/FDE-95)
- **Subtask Issue**: [FDE-99](https://linear.app/fdem/issue/FDE-99)
- **Status**: Completed
- **Created**: 2026-09-17
- **Target Files**:
  - `backend/gateway/src/index.ts`
  - `backend/gateway/src/rate_limiter.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • RATE_LIMIT_   │     │ • Implement      │     │ • Fast burst test│     │ • Linear Done   │
│   PER_MINUTE    │     │   sliding-window │     │   triggers 429   │     │ • Plan status   │
│   (default: 30) │     │   rate limiter   │     │ • Verify resetsAt│     │   updated       │
│ • Key: userId   │     │ • Return 429 when│     │   or resetsAfter │     │ • 0 type errors │
│                 │     │   limit exceeded │     │   in response    │     │ • Ready for 7.5 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
1. Implement in-memory sliding-window rate limiter per `userId`:
   - Configurable via `env.rateLimitPerMinute` (default: 30 requests per 60 seconds).
   - Exempt `/health` and `/evals/report.json`.
   - When request count within current 60s window exceeds limit:
     - Return HTTP `429 Too Many Requests`.
     - JSON payload: `{ error: 'rate limit exceeded', status: 429, requestId }`.

---

## Acceptance Criteria
- [x] Requests exceeding rate limit within window return 429 Too Many Requests.
- [x] Each user maintains independent rate limit bucket.
- [x] Full workspace passes `npm run typecheck`.
