# Implementation Plan: US-3 Agent Service Quick Search Engine & Streaming SSE Harness

**Parent Issue**: [US-3: Agent Service Quick Search Engine & Streaming SSE Harness](https://linear.app/fdem/issue/FDE-68)  
**Related Linear Issues**: [FDE-7](https://linear.app/fdem/issue/FDE-7), [FDE-21](https://linear.app/fdem/issue/FDE-21) through [FDE-28](https://linear.app/fdem/issue/FDE-28), [FDE-69](https://linear.app/fdem/issue/FDE-69) through [FDE-76](https://linear.app/fdem/issue/FDE-76)  
**Status**: Completed (100%)  
**Goal**: Build the complete private Agent Service (`backend/agent/`) core: MongoDB client and GridFS integration, dynamic `GET /health`, search and fetch tools, two-tier search caching (LRU + Mongo TTL), the Quick ReAct reasoning loop with fail-loud semantics and hard caps, unbuffered streaming SSE route (`POST /threads/:id/ask`), thread/message persistence, and structured run logging (`runs/<requestId>.json`).

---

## 1. Subtasks Breakdown

```
US-3: Agent Service Quick Search Engine & Streaming SSE Harness
├── Task 3.1 (FDE-69 / FDE-21): Implement MongoDB database client & GridFS bucket (backend/agent/src/db.ts)
├── Task 3.2 (FDE-70 / FDE-22): Implement GET /health with live component dependency reporting
├── Task 3.3 (FDE-71 / FDE-23): Implement web_search and fetch_page tools with query normalization
├── Task 3.4 (FDE-72 / FDE-24): Implement two-tier search cache (in-memory LRU + MongoDB searchCache TTL)
├── Task 3.5 (FDE-73 / FDE-25): Implement Quick ReAct agent loop with hard caps (8 tool calls, 90s) & fail-loud semantics
├── Task 3.6 (FDE-74 / FDE-26): Implement unbuffered SSE streaming (POST /threads/:id/ask) with sources preceding tokens
├── Task 3.7 (FDE-75 / FDE-27): Implement thread and message persistence (POST/GET/DELETE /threads)
└── Task 3.8 (FDE-76 / FDE-28): Implement runs/<requestId>.json execution logging conforming to contract schema
```

---

## 2. Technical Architecture & Component Design

### Component 1: Database & GridFS Client (`backend/agent/src/db.ts`)
- Reusable `MongoClient` singleton with connection pooling and graceful disconnect handlers.
- Collection accessors with TypeScript typing: `threads`, `messages`, `memories`, `spaces`, `documents`, `chunks`, `jobs`, `searchCache`, `requests`, `runs`.
- `GridFSBucket` accessor initialized on `lumina` database with bucket name `fs`.
- `pingDb()` method returning `'ok' | 'down'` based on `{ ping: 1 }` command.

### Component 2: Dynamic Health Endpoint (`GET /health`)
- Returns `HealthResponse` schema from `@lumina/contract`:
  ```ts
  {
    status: 'ok' | 'degraded',
    model: env.llmModel, // e.g. "gemini-2.0-flash"
    searchProvider: env.searchProvider, // "tavily"
    vectorStore: env.vectorBackend, // "atlas-vector-search"
    db: 'ok' | 'down',
    ai: { status: 'ok' }
  }
  ```

### Component 3: Tools & Two-Tier Search Cache (`backend/agent/src/tools/`)
- **Query Normalization**: Lowercase, strip punctuation and extra spaces.
- **Cache Key**: `sha256(normalized_query + ":" + provider)`.
- **Two-Tier Cache Hierarchy**:
  - **Tier 1 (In-Process LRU)**: Fast in-memory cache (`lru-cache` / bounded Map, max 500 items).
  - **Tier 2 (MongoDB TTL)**: Persisted in `searchCache` collection with TTL index on `expiresAt` (`SEARCH_CACHE_TTL_SECONDS=21600`).
- **`web_search` tool**:
  - Checks Tier 1 $\rightarrow$ Tier 2 $\rightarrow$ Provider call (Tavily API via `TAVILY_API_KEY`).
  - Returns `title`, `url`, `snippet`, `content`.
  - Tracks whether every search in the query hit cache $\rightarrow$ sets `searchCached: true/false`.
- **`fetch_page` tool**:
  - Downloads full web page via `fetch()` with a 10s timeout and User-Agent header.
  - Strips HTML tags, styles, and scripts; extracts clean readable text.

### Component 4: Quick ReAct Loop (`backend/agent/src/loop.ts`)
- **LLM Client**: Multi-provider support (Google AI Studio Gemini via OpenAI-compatible endpoint or SDK with `GEMINI_API_KEY`, Anthropic, or OpenAI).
- **Prompt Engineering**: Enforces strict grounding — only cite URLs fetched in that exact request, formatted as `[n]`.
- **Tool Calling**: Iterative ReAct loop executing tools sequentially.
- **Caps & Limits**:
  - Hard cap: Max 8 tool calls.
  - Wall-clock timeout: 90 seconds.
  - Over-cap handling: If 8 calls reached, terminate with `terminated: "cap"` and synthesize best partial answer from existing sources.
- **Fail Loud**: Upstream provider errors throw HTTP 502 with `{ terminated: "error", error: "<message>" }`. Never return fake plausible answers.

### Component 5: Unbuffered SSE Stream (`POST /threads/:id/ask`)
- **Strict Event Sequence**:
  1. `trace` (emitted on every thought, tool call start, and tool call finish)
  2. `sources` (**MUST be emitted BEFORE the first token**)
  3. `token` (streamed token-by-token from LLM synthesis)
  4. `done` (contains final metrics: `answerId`, `latencyMs`, `ttftMs`, `tokens`, `costUsd`, `searchCached`, `terminated: "done" | "cap" | "error"`)
- **Unbuffered Flushing**: Flush response buffer after each SSE line to guarantee TTFT $< 2500$ms.

### Component 6: Thread & Message Storage
- `POST /threads`: Create thread `{ threadId, userId, title, createdAt }`.
- `GET /threads`: List threads for `X-User-Id`.
- `GET /threads/:id`: Fetch thread and message history.
- `DELETE /threads/:id`: Remove thread and all its messages.
- Context injection: Inject previous user & assistant turns into the LLM system prompt on follow-up questions.

### Component 7: Run Logging (`runs/<requestId>.json`)
- Writes structured JSON record adhering strictly to `@lumina/contract` `RunLog` schema:
  - `requestId`, `userId`, `threadId`, `depth: "quick"`
  - `toolCalls: [{ name, ok, durationMs, error }]`
  - `tokens: { in, out }`, `costUsd`, `latencyMs`, `ttftMs`
  - `searchCached`, `terminated`

---

## 3. Verification Plan

### Automated Tests
1. **Unit & Build Tests**:
   - `npm run typecheck` across monorepo workspaces.
   - `npm run build -w @lumina/agent`.
2. **Health Check Probe**:
   - `curl http://localhost:8000/health` $\rightarrow$ verifies `{ status: "ok", db: "ok" }`.
3. **SSE Stream Verification**:
   - `curl -N -X POST http://localhost:8000/threads/t_test/ask -H "x-user-id: test_user" -H "Content-Type: application/json" -d '{"query":"latest news about AI"}'`
   - Validate that `sources` event is received **before** the first `token` event.
4. **Cache Repeat Test**:
   - Execute the same query twice $\rightarrow$ verify second run emits `searchCached: true` and makes zero external Tavily API calls.
5. **Run Log Schema Validation**:
   - Run `node quality/check.mjs .` against generated `runs/*.json` files.
