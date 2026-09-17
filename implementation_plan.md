# Implementation Plan: US-1 System Architecture, Scaffolding & System Design Document

**Linear User Story**: [FDE-5 / FDE-59: US-1 System Architecture, Scaffolding & System Design Document](https://linear.app/fdem/issue/FDE-5/us-1-system-architecture-scaffolding-and-system-design-document)  
**Parent Project**: LUMINA  
**Priority**: Urgent (P1)  
**Goal**: Unpack the LUMINA assignment monorepo files into the workspace root (`c:\projects\FDE`), verify dependencies and monorepo type-checking, configure `.env` with provider keys and connection strings, and author the mandatory [DESIGN.md](file:///c:/projects/FDE/DESIGN.md) answering all 5 system design questions required by the grading engine.

---

## User Review Required

> [!IMPORTANT]
> **1. Workspace File Migration & Overwrites**
> The LUMINA monorepo currently resides nested inside `c:\projects\FDE\repo_temp\modules\Module_1_Agent_Foundations_Harness_System_Design\Assignment_1_Lumina`.
> Unpacking it to `c:\projects\FDE\` will introduce root files (`package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.mjs`, `PRD.md`, `SPEC.md`, `TECHNICAL.md`, etc.).
> - Existing non-monorepo files (`FDE-01.docx`, `TASKS.md`, `linear_import_lumina.csv`, `.agents/`, `scripts/.linear_token`, `scripts/sync_to_linear.mjs`) will be strictly preserved.
> - After copying and verifying, `repo_temp/` will be removed to keep the repository clean.

> [!WARNING]
> **2. Environment Secrets Setup (.env)**
> For Task 1.3, we will copy `.env.example` to `.env`. Running the full system and vector index creation requires:
> - `MONGODB_URI` (MongoDB Atlas cluster connection string)
> - `OPENAI_API_KEY` (Required for `text-embedding-3-small` vector embeddings)
> - `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (For LLM search loop reasoning)
> - `TAVILY_API_KEY` (For live web search retrieval)
> Please confirm if you have these keys ready or want placeholders configured initially while verifying typecheck.

---

## Open Questions

1. **MongoDB Atlas Cluster**: Do you already have an active MongoDB Atlas cluster URI ready to insert into `.env`, or should we set up a template `.env` and guide you through index creation?
2. **Primary LLM Provider**: Are you planning to use Anthropic Claude (`claude-3-5-sonnet-20241022`) as primary, or OpenAI (`gpt-4o-mini` / `gpt-4o`)?

---

## Proposed Changes

The implementation is broken down into the 4 subtasks defined in Linear:

```
US-1: System Architecture, Scaffolding & System Design Document
├── Task 1.1 (FDE-60): Unpack monorepo files into workspace root & preserve course notes
├── Task 1.2 (FDE-61): Monorepo dependency installation & typecheck verification
├── Task 1.3 (FDE-62): Configure .env with environment variables & provider keys
└── Task 1.4 (FDE-63): Author DESIGN.md answering the 5 mandatory system design questions
```

---

### Subtask 1.1: Unpack Monorepo Files (FDE-60)

Copy monorepo files from nested directory to workspace root, merging scripts without overwriting custom tools, and clean up temporary directory.

#### [NEW] Monorepo Files in Workspace Root:
- Root configuration: `package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.mjs`, `docker-compose.yml`, `expectations.json`
- Course specifications: `PRD.md`, `SPEC.md`, `TECHNICAL.md`, `AGENTS.md`, `DESIGN.template.md`
- Sub-packages:
  - `backend/agent/` (`src/index.ts`, `src/db.ts`, `src/env.ts`, `src/worker.ts`, `package.json`, `tsconfig.json`)
  - `backend/gateway/` (`src/index.ts`, `package.json`, `tsconfig.json`)
  - `packages/contract/` (`src/index.ts`, `src/http.ts`, `src/sse.ts`, `src/db.ts`, `src/ids.ts`, `src/report.ts`)
  - `web/` (React 18 + Vite UI, components, Tailwind/CSS, pages)
  - `benchmark/` (`bench.mjs`, SLA benchmark runner)
  - `eval/` (`eval.mjs`, `build-report.mjs`, grading suites)
  - `quality/` (`check.mjs`, rules.json)
  - `scripts/` (`create-indexes.mjs`, `export-runs.mjs`, `indexes.json`)
- Preserve existing:
  - `FDE-01.docx` (Course notes / syllabus)
  - `TASKS.md` (Local tracking board)
  - `scripts/.linear_token` & `scripts/sync_to_linear.mjs` (Linear synchronization tooling)
  - `.agents/` (Antigravity project agent configuration)

#### [DELETE]
- `c:\projects\FDE\repo_temp` (Cleaned up once files are copied and verified)

---

### Subtask 1.2: Monorepo Dependency Installation & Typecheck (FDE-61)

Install dependencies across the monorepo and verify compile-time contract integrity.

- Run `npm install` at root (`c:\projects\FDE`). This installs all dependencies for `@lumina/contract`, `@lumina/agent`, `@lumina/gateway`, and `@lumina/web`.
- Compile contract library: `npm run build -w @lumina/contract` (generates contract `.d.ts` and `.js` distribution for consumer packages).
- Run `npm run typecheck` across all workspaces (`packages/contract`, `backend/agent`, `backend/gateway`, `web`).
- Fix any baseline TypeScript compilation discrepancies or path resolution issues if present in starter templates.

---

### Subtask 1.3: Configure .env File (FDE-62)

Establish local development and test environment configuration.

#### [NEW] [.env](file:///c:/projects/FDE/.env)
- Create `.env` based on `.env.example`:
  ```env
  # Server Ports
  GATEWAY_PORT=8787
  AGENT_PORT=8000
  AGENT_URL=http://localhost:8000
  PORT=8787

  # Database
  MONGODB_URI=mongodb+srv://...

  # Models & Providers
  ANTHROPIC_API_KEY=...
  OPENAI_API_KEY=...
  TAVILY_API_KEY=...

  # Vector Backend: atlas (production) or mongo-cosine-scan (dev fallback)
  VECTOR_BACKEND=atlas
  ```
- Verify non-negotiable security boundary: Gateway package only receives `AGENT_URL`, `GATEWAY_PORT`, and `PORT`. LLM and DB credentials are strictly restricted to the private Agent service.

---

### Subtask 1.4: Author DESIGN.md (FDE-63)

Author [DESIGN.md](file:///c:/projects/FDE/DESIGN.md) in the project root based on `DESIGN.template.md`.  
`eval/build-report.mjs` strictly parses `DESIGN.md` by heading (`readDesign(path)`), requiring the exact five headings:

#### [NEW] [DESIGN.md](file:///c:/projects/FDE/DESIGN.md)

1. `## Components`
   - **Web UI** (`web/`): Client-side React 18 + Vite running on port 5173 (or Vercel in production). Renders search interface, stream responses, clickable citations, and `/evals` report.
   - **Edge Gateway** (`backend/gateway/`): Public HTTP/SSE reverse proxy running on port 8787 (Fly.io / serverless). Handles CORS, client request validation via Zod (`@lumina/contract`), rate-limiting, and transparent SSE forwarding.
   - **Agent Service** (`backend/agent/`): Private backend service on port 8000. Houses the agent loop, LLM prompt generation, tool execution (`web_search`, `fetch_page`, `save_memory`, `recall_memory`), memory retrieval, RAG, and execution logging.
   - **MongoDB Atlas**: Authoritative datastore (`lumina` database) holding collections: `threads`, `messages`, `memories`, `spaces`, `documents`, `chunks`, `jobs`, `searchCache`, and GridFS buckets (`fs.files`, `fs.chunks`).
   - **Asynchronous Worker** (`backend/agent/src/worker.ts`): Background worker polling `jobs` collection to process PDF document uploads into text chunks and generate embeddings.
   - **Search Cache**: Two-tier caching layer (in-memory LRU + MongoDB `searchCache` collection with TTL index).
   - **Run Logs** (`runs/<requestId>.json`): Structured telemetry capturing trajectory, prompt tokens, latency, cost, and tool call traces.

2. `## Responsibilities`
   - **Gateway Exclusions**: Gateway is the ONLY component allowed to speak directly to the browser and validate client JWT/X-User-Id. It is strictly FORBIDDEN from holding provider API keys (`ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `MONGODB_URI`), executing tools, or making LLM calls.
   - **Agent Exclusions**: Agent service is the ONLY component allowed to hold provider keys, connect to MongoDB, execute tools, and determine request budget/termination. It NEVER communicates directly with the public internet or browser.
   - **Web UI Exclusions**: Web UI only initiates user requests, streams tokens, and renders citations. It contains ZERO business logic, NO secret keys bundled into client JS, and NO direct database connections.

3. `## Communication`
   - **Browser ↔ Gateway**: HTTP POST for queries and space/document uploads; Server-Sent Events (SSE) for query streaming over text/event-stream.
   - **Gateway ↔ Agent**: Transparent HTTP reverse proxy. Streams SSE chunks unbuffered (`trace` → `sources` → `token` → `done`).
   - **Agent ↔ Providers**: HTTPS calls to Anthropic/OpenAI and Tavily API.
   - **Failure Modes & "Fail Loud"**: When upstream services (LLM, Tavily, MongoDB) fail or timeout, the system throws a 502 Bad Gateway with `{ terminated: "error", error: "<message>" }`. Silent fallbacks or fabricated answers are strictly prohibited.

4. `## State`
   - **Authoritative Data**: MongoDB Atlas collections (`threads`, `messages`, `memories`, `spaces`, `documents`, `chunks`, `jobs`) and GridFS.
   - **Ephemeral Data**: Tier-1 in-memory LRU cache and Tier-2 MongoDB `searchCache` (TTL index auto-expires after 24 hours). If cleared, system remains 100% functional with negligible latency degradation.
   - **Consistency Story**: Document ingestion follows an asynchronous queue (`jobs`). Upload returns `202 Accepted` immediately. Documents become searchable only after chunking and vector indexing succeed (`job.status = 'completed'`). Vector search uses read-your-write probes to prevent stale queries.

5. `## Trade-offs`
   - **Atlas Vector Search vs. Dedicated Vector Store (e.g. Qdrant / Pinecone)**: Chosen Atlas Vector Search to consolidate metadata, relational threads, and vectors into a single ACID-compliant database with zero multi-database drift, at the cost of the M0 tier 3-index limitation and index synchronization lag.
   - **In-process LRU + MongoDB TTL vs. External Redis**: Chosen hybrid memory/Mongo cache to avoid external cache cluster infrastructure and network roundtrips, giving up distributed cache invalidation across horizontal agent replicas.
   - **Single Agent Sequential Execution Loop vs. Multi-Agent Orchestrator**: Chosen a deterministic single-agent loop capped at 8 tool calls and 90s to guarantee strict SLA compliance and predictable latencies, at the cost of parallel fan-out subagent exploration.
   - **GridFS + Mongo Queue vs. S3 + SQS**: Chosen GridFS + MongoDB polling worker for zero external cloud dependency during development and grading, trading off high-throughput concurrent throughput.

---

## Verification Plan

### Automated Tests
1. **Directory Structure Verification**:
   - Check that `web/`, `backend/`, `packages/contract/`, `benchmark/`, `eval/`, `quality/`, `scripts/` exist at `c:\projects\FDE\`.
   - Verify course notes (`FDE-01.docx`) and Linear tooling (`scripts/.linear_token`, `scripts/sync_to_linear.mjs`) remain intact.
2. **Contract Compilation**:
   ```bash
   npm run build -w @lumina/contract
   ```
3. **Workspace Typecheck**:
   ```bash
   npm run typecheck
   ```
4. **DESIGN.md Parsing Verification**:
   Run the evaluation parser to ensure zero missing sections:
   ```bash
   node -e "import('node:fs').then(() => { const md = require('node:fs').readFileSync('DESIGN.md', 'utf8'); ['components', 'responsibilities', 'communication', 'state', 'tradeoffs'].forEach(s => console.log(s, new RegExp(s, 'i').test(md) ? 'OK' : 'MISSING')); })"
   ```

### Manual Verification & Linear Tracking
1. Verify `DESIGN.md` reads clearly and articulates all architectural choices.
2. Update Linear subtasks (FDE-60, FDE-61, FDE-62, FDE-63) to `In Progress` and `Done` upon completion.
3. Update `TASKS.md` in root to reflect Phase 0 completion.
