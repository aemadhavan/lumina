# Task 7.1 Plan: Implement X-User-Id authentication guard (401 if missing)

## Metadata & Links
- **Parent Issue**: [FDE-95 (US-7: Edge Gateway)](https://linear.app/fdem/issue/FDE-95)
- **Subtask Issue**: [FDE-96](https://linear.app/fdem/issue/FDE-96)
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
│ • Contract auth │     │ • Middleware     │     │ • Probe 401 on   │     │ • Linear Done   │
│   rules: 401 if │     │   checks         │     │   missing header │     │ • Plan status   │
│   missing except│     │   X-User-Id      │     │ • Probe 200 on   │     │   updated       │
│   health/evals  │     │ • Return 401 JSON│     │   /health &      │     │ • 0 type errors │
│                 │     │   with requestId │     │   /evals/report  │     │ • Ready for 7.2 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Implement edge authentication middleware in `backend/gateway/src/index.ts`:
1. Check `x-user-id` header on every request.
2. If path is `/health` or starts with `/evals/report.json` or is a static asset, bypass auth check.
3. If `x-user-id` is missing or empty string:
   - Return HTTP `401 Unauthorized`.
   - JSON payload: `{ error: "missing or empty x-user-id header", status: 401, requestId: string }`.

---

## Acceptance Criteria
- [x] Requests without `X-User-Id` to protected endpoints (`/threads`, `/memory`, `/spaces`, `/stats`) return 401.
- [x] Requests to `/health` return 200 without `X-User-Id`.
- [x] Requests to `/evals/report.json` do not return 401 without `X-User-Id`.
- [x] Full workspace passes `npm run typecheck`.
