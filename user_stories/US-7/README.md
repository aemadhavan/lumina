# User Story 7 (US-7): Edge Gateway Validation, Proxying & Rate Limiting

**Linear Reference**: [FDE-95](https://linear.app/fdem/issue/FDE-95) / [FDE-11](https://linear.app/fdem/issue/FDE-11)  
**Parent Project**: LUMINA  
**Status**: Completed  

---

## 1. Subtasks & Implementation Status

| Linear Issue | Task Name | Status | Plan & Evidence |
| :--- | :--- | :--- | :--- |
| [FDE-96](https://linear.app/fdem/issue/FDE-96) | Task 7.1: Implement `X-User-Id` authentication guard (`401` if missing) | Completed | [task_7.1_plan.md](task_7.1_plan.md) |
| [FDE-97](https://linear.app/fdem/issue/FDE-97) | Task 7.2: Implement `X-Request-Id` correlation and Pino structured logging | Completed | [task_7.2_plan.md](task_7.2_plan.md) |
| [FDE-98](https://linear.app/fdem/issue/FDE-98) | Task 7.3: Implement Zod schema validation using `@lumina/contract` (`400` on bad payload) | Completed | [task_7.3_plan.md](task_7.3_plan.md) |
| [FDE-99](https://linear.app/fdem/issue/FDE-99) | Task 7.4: Implement per-user rate limiting (`429`) | Completed | [task_7.4_plan.md](task_7.4_plan.md) |
| [FDE-100](https://linear.app/fdem/issue/FDE-100) | Task 7.5: Implement transparent reverse proxy and unbuffered SSE pass-through to agent service | Completed | [task_7.5_plan.md](task_7.5_plan.md) |
| [FDE-101](https://linear.app/fdem/issue/FDE-101) | Task 7.6: Implement `/health`, `/stats`, and `/evals/report.json` endpoints | Completed | [task_7.6_plan.md](task_7.6_plan.md) |

---

## 2. Architecture & Deliverables

1. **Inbound Security Boundary**:
   - The browser talks ONLY to the Gateway (`:8787`).
   - `X-User-Id` is strictly enforced across all contract routes (`auth: true`), returning `401 Unauthorized` if missing or blank.
   - `/health` and `/evals/report.json` are public (`auth: false`).
2. **Correlation & Observability**:
   - `X-Request-Id` is propagated from inbound headers or generated, forwarded upstream to Agent (`:8000`), and logged via Pino JSON lines.
3. **Payload Contract Validation**:
   - Inbound request bodies validated against `@lumina/contract` schemas (`AskBody`, `CreateThreadBody`, `CreateSpaceBody`).
   - Malformed requests return `400 Bad Request` with Zod issue details.
4. **Sliding-Window Rate Limiter**:
   - Enforces `RATE_LIMIT_PER_MINUTE` (default: 30) per `X-User-Id`.
   - Exceeded rate limit returns `429 Too Many Requests`.
5. **Transparent Reverse Proxy & Unbuffered SSE**:
   - Non-streaming routes (`/threads`, `/spaces`, `/memory`, `/stats`) proxied cleanly to `env.agentUrl`.
   - Multipart document upload (`POST /spaces/:id/documents`) passed through without corrupting file streams.
   - SSE route (`POST /threads/:id/ask`) streamed unbuffered with immediate flushing and exact SSE headers.
   - Any agent/network failure results in HTTP `502 Bad Gateway` (never a 200 with fake response).
6. **Operational Endpoints & Static UI**:
   - `GET /health`: Combines gateway status and upstream agent health check.
   - `GET /stats`: Proxied to agent service to deliver unified counts and metrics.
   - `GET /evals/report.json`: Serves evaluation report if generated.
   - Static asset hosting for `web/dist/`.
