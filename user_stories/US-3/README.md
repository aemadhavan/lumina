# User Story 3 (US-3): Agent Service Quick Search Engine & Streaming SSE Harness

**Linear Reference**: [FDE-7](https://linear.app/fdem/issue/FDE-7) / [FDE-68](https://linear.app/fdem/issue/FDE-68)  
**Parent Project**: LUMINA  
**Status**: Completed (100%)  

---

## 1. Subtasks & Implementation Status

| Linear Issue | Task Name | Status | Plan & Evidence |
| :--- | :--- | :--- | :--- |
| [FDE-69 / FDE-21](https://linear.app/fdem/issue/FDE-69) | Task 3.1: Implement MongoDB database client & GridFS bucket (`backend/agent/src/db.ts`) | **Done** | [task_3.1_plan.md](task_3.1_plan.md) |
| [FDE-70 / FDE-22](https://linear.app/fdem/issue/FDE-70) | Task 3.2: Implement `GET /health` with live component dependency reporting | **Done** | [task_3.2_plan.md](task_3.2_plan.md) |
| [FDE-71 / FDE-23](https://linear.app/fdem/issue/FDE-71) | Task 3.3: Implement `web_search` and `fetch_page` tools with query normalization | **Done** | [task_3.3_plan.md](task_3.3_plan.md) |
| [FDE-72 / FDE-24](https://linear.app/fdem/issue/FDE-72) | Task 3.4: Implement two-tier search cache (in-memory LRU + MongoDB `searchCache` TTL) | **Done** | [task_3.4_plan.md](task_3.4_plan.md) |
| [FDE-73 / FDE-25](https://linear.app/fdem/issue/FDE-73) | Task 3.5: Implement Quick ReAct agent loop with hard caps (8 tool calls, 90s) and fail-loud semantics | **Done** | [task_3.5_plan.md](task_3.5_plan.md) |
| [FDE-74 / FDE-26](https://linear.app/fdem/issue/FDE-74) | Task 3.6: Implement unbuffered SSE streaming (`POST /threads/:id/ask`) with sources preceding tokens | **Done** | [task_3.6_plan.md](task_3.6_plan.md) |
| [FDE-75 / FDE-27](https://linear.app/fdem/issue/FDE-75) | Task 3.7: Implement thread and message persistence (`POST/GET/DELETE /threads`) | **Done** | [task_3.7_plan.md](task_3.7_plan.md) |
| [FDE-76 / FDE-28](https://linear.app/fdem/issue/FDE-76) | Task 3.8: Implement `runs/<requestId>.json` execution logging conforming to contract schema | **Done** | [task_3.8_plan.md](task_3.8_plan.md) |

---

## 2. Key Architecture & Deliverables

- **Database Client & Typed Collections (`db.ts`)**: Singleton `MongoClient` with connection pooling, GridFS bucket for `uploads`, and typed collection getters for `threads`, `messages`, `memories`, `spaces`, `documents`, `chunks`, `searchCache`, `jobs`, `requests`, and `runs`.
- **Health Reporting (`GET /health`)**: Live dependency reporting (`db`, `ai`, `model`, `searchProvider`, `vectorStore`) conforming strictly to contract `HealthResponse` schema.
- **Search & Page Fetch Tools (`tools/`)**: Tavily and SerpApi client integrations, query normalization with SHA-256 hashing, and JSDOM/Mozilla Readability HTML text extraction with virtual console noise suppression.
- **Two-Tier Search Cache (`cache.ts`)**: In-memory `LRUCache` (Tier 1) backed by MongoDB `searchCache` with TTL (Tier 2), returning `searchCached: true` on hits.
- **Quick ReAct Reasoning Loop (`loop.ts`)**: Fast search loop with hard caps (8 tool calls, 90s) and fail-loud error propagation. Emits structured `TraceEvent` records and synthesizes answers using only retrieved source text.
- **Streaming SSE Harness (`routes/threads.ts`)**: Unbuffered event-stream emitting `trace` $\rightarrow$ `sources` $\rightarrow$ `token` $\rightarrow$ `done`, guaranteeing that citation chips render in the UI before tokens stream.
- **Thread & Message Persistence (`routes/threads.ts`)**: Complete thread lifecycle (`POST/GET/DELETE /threads`, `GET /threads/:id/messages`) with message history injection.
- **Execution Run Logging (`runs.ts`)**: Emits `runs/<requestId>.json` and persists to `runs/failing/` on deliberate failures, strictly verified by `node quality/check.mjs .`.
