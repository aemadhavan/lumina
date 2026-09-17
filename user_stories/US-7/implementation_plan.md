# User Story 7 Implementation Plan: Edge Gateway Validation, Proxying & Rate Limiting

## 1. Overview
The Gateway Service (`backend/gateway/`) is the single front door for the LUMINA system running on port 8787. The browser and benchmark suite communicate exclusively with the Gateway. The Gateway enforces edge authentication, rate limits, schema validation, and structured request logging, and transparently proxies traffic and SSE streams to the private Agent Service (`:8000`).

---

## 2. Technical Architecture

### 2.1 Middleware Pipeline
```
Inbound Request
   │
   ├──> CORS (allowed origins, exposed headers: X-Request-Id)
   │
   ├──> Request Correlation (extract or generate X-Request-Id, set response header)
   │
   ├──> Pino HTTP Logger (structured log with method, route, status, ms, requestId, userId)
   │
   ├──> Authentication Guard (check X-User-Id; return 401 if missing and route.auth !== false)
   │
   ├──> Rate Limiter (sliding window per userId, return 429 if > RATE_LIMIT_PER_MINUTE)
   │
   ├──> Body Parsing (JSON for standard routes, raw stream pass-through for multipart /documents)
   │
   ├──> Zod Contract Validation (validate request payload, return 400 with details on mismatch)
   │
   └──> Reverse Proxy / Route Handler:
          ├── /health -> local aggregation with agent /health
          ├── /evals/report.json -> serve reports/report.json or eval/report.json
          ├── /threads/:id/ask -> SSE unbuffered stream pass-through with sseHeaders()
          ├── static web/dist -> serve prebuilt frontend SPA
          └── all other routes -> proxy HTTP to agentUrl (:8000)
```

---

## 3. Subtask Breakdown

- **Task 7.1 ([FDE-96](https://linear.app/fdem/issue/FDE-96))**: Implement `X-User-Id` authentication guard (`401` if missing).
- **Task 7.2 ([FDE-97](https://linear.app/fdem/issue/FDE-97))**: Implement `X-Request-Id` correlation and Pino structured logging.
- **Task 7.3 ([FDE-98](https://linear.app/fdem/issue/FDE-98))**: Implement Zod schema validation using `@lumina/contract` (`400` on bad payload).
- **Task 7.4 ([FDE-99](https://linear.app/fdem/issue/FDE-99))**: Implement per-user sliding-window rate limiting (`429`).
- **Task 7.5 ([FDE-100](https://linear.app/fdem/issue/FDE-100))**: Implement transparent reverse proxy and unbuffered SSE pass-through to agent service.
- **Task 7.6 ([FDE-101](https://linear.app/fdem/issue/FDE-101))**: Implement `/health`, `/stats`, and `/evals/report.json` endpoints.

---

## 4. Verification Plan
- Unit & integration testing using native fetch / ephemeral server:
  - Verify 401 without `X-User-Id` on `/memory`, `/threads`, `/spaces`, `/stats`.
  - Verify `/health` and `/evals/report.json` bypass 401.
  - Verify 400 on invalid body (`POST /threads/thr_x/ask` with empty body).
  - Verify rate limiter triggers 429 when quota exceeded.
  - Verify reverse proxy forwards requests to agent `:8000` with headers and returns responses.
  - Verify SSE streaming flushes tokens unbuffered frame-by-frame.
