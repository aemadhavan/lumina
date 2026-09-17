# Task 7.6 Plan: Implement /health, /stats, and /evals/report.json endpoints

## Metadata & Links
- **Parent Issue**: [FDE-95 (US-7: Edge Gateway)](https://linear.app/fdem/issue/FDE-95)
- **Subtask Issue**: [FDE-101](https://linear.app/fdem/issue/FDE-101)
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
│ • Health schema │     │ • /health with   │     │ • Test /health   │     │ • Linear Done   │
│ • Stats schema  │     │   agent check    │     │ • Test /stats    │     │ • Plan status   │
│ • evals report  │     │ • /stats proxy   │     │ • Test /evals/   │     │   updated       │
│   serving       │     │ • /evals/report  │     │   report.json    │     │ • 0 type errors │
│                 │     │   file serving   │     │   without auth   │     │ • US-7 Complete │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
1. `GET /health`:
   - Query `${env.agentUrl}/health`.
   - Aggregate status and return `HealthResponse` (`status: 'ok' | 'degraded'`, `model`, `searchProvider`, `vectorStore`, `db`, `ai`).
2. `GET /stats`:
   - Requires `X-User-Id` (`auth: true`).
   - Proxied to Agent Service `${env.agentUrl}/stats`.
3. `GET /evals/report.json`:
   - Does NOT require `X-User-Id` (`auth: false`).
   - Serves generated evaluation report from `reports/report.json` or `eval/report.json`.
   - If not yet created, returns 404 or an initial scaffold.
4. Static Asset Hosting:
   - Serves prebuilt frontend assets from `web/dist/` with SPA index fallback.

---

## Acceptance Criteria
- [x] `GET /health` returns aggregated status without requiring `X-User-Id`.
- [x] `GET /stats` returns `StatsResponse` matching contract.
- [x] `GET /evals/report.json` is public and serves evaluation JSON when generated.
- [x] Full workspace passes `npm run typecheck`.
