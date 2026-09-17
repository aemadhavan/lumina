# Task 7.5 Plan: Implement transparent reverse proxy and unbuffered SSE pass-through to agent service

## Metadata & Links
- **Parent Issue**: [FDE-95 (US-7: Edge Gateway)](https://linear.app/fdem/issue/FDE-95)
- **Subtask Issue**: [FDE-100](https://linear.app/fdem/issue/FDE-100)
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
│ • Unbuffered SSE│     │ • Transparent    │     │ • Verify SSE     │     │ • Linear Done   │
│   flush headers │     │   HTTP proxy     │     │   streams tokens │     │ • Plan status   │
│ • Multipart     │     │ • Unbuffered SSE │     │   in real-time   │     │   updated       │
│   upload proxy  │     │   streaming pipe │     │ • Verify CRUD    │     │ • 0 type errors │
│ • Fail-loud 502 │     │ • 502 on upstream│     │   proxy routes   │     │ • Ready for 7.6 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
1. Transparent HTTP Proxying:
   - Forward HTTP requests for `/threads`, `/spaces`, `/memory`, `/stats` to `env.agentUrl`.
   - Forward headers (`X-User-Id`, `X-Request-Id`, `Content-Type`).
   - Forward response status, headers, and body.
2. Unbuffered SSE Stream Pass-Through (`POST /threads/:id/ask`):
   - Set unbuffered SSE headers (`Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`).
   - Call `res.flushHeaders()`.
   - Stream incoming response chunks directly to client and flush after each chunk.
   - If upstream agent returns non-200 (e.g. 429 or 502), forward status and error body.
3. Fail-Loud Error Handling:
   - If agent connection drops or refuses, return `502 Bad Gateway` with error message.

---

## Acceptance Criteria
- [x] CRUD routes (`/threads`, `/spaces`, `/memory`, `/stats`) forward cleanly to agent and return correct status codes.
- [x] `/threads/:id/ask` SSE events stream with zero buffering and immediate token delivery.
- [x] Upstream connection errors return 502 Bad Gateway.
- [x] Full workspace passes `npm run typecheck`.
