# DESIGN.md — LUMINA

## Components

LUMINA is composed of six distinct parts distributed across edge hosting, container runtime, and managed cloud infrastructure:
1. **Web Frontend (`web/`)**: A React SPA deployed on Vercel. It provides the user interface for asking questions, toggling Quick vs. Deep modes, rendering streaming token responses with live citation chips, managing document spaces, and displaying the `/evals` scorecard.
2. **Gateway Service (`backend/gateway/`)**: An Express reverse-proxy running on Railway (port 8787). It acts as the public edge boundary, handling CORS, client IP tracking, `X-User-Id` authentication validation, Zod request body validation, and unbuffered SSE pass-through.
3. **Agent Core (`backend/agent/`)**: An internal Express service on port 8000 (running behind the gateway on Railway). It houses the core ReAct reasoning loop, tool execution (`web_search`, `fetch_page`, `search_documents`, `recall_memory`, `save_memory`, `plan_research`), LLM orchestration, and budget/cap enforcement.
4. **Ingestion Worker (`backend/agent/src/worker.ts`)**: A background Node.js process polling the `jobs` collection in MongoDB Atlas. It performs PDF parsing from GridFS, section/page chunking, text embedding generation, and vector index verification.
5. **MongoDB Atlas Cluster**: The unified persistence layer. It stores relational state (`threads`, `messages`, `memories`, `spaces`, `documents`), searchable chunks (`chunks` with vector and text indexes), document binaries (`fs.files`, `fs.chunks`), and the queued `jobs` collection.
6. **Auxiliary State Layers**: A two-tier search cache combining an in-memory LRU cache inside the agent process with a 24-hour TTL collection (`searchCache`) in MongoDB, plus append-only run trajectory files (`runs/<requestId>.json`) used by the evaluator and `/evals` page.

## Responsibilities

We maintain strict architectural boundaries between components with clear negative constraints (exclusions):
- **Gateway**: The Gateway is the **only** component exposed to the public internet and client browsers. It alone validates `X-User-Id`, applies client rate-limiting, and parses/verifies request schemas. Conversely, it is strictly forbidden from holding provider API keys (OpenAI, Anthropic, Gemini, Tavily), connecting to MongoDB, or running LLM completions.
- **Agent Service**: The Agent is the **only** component allowed to hold external provider credentials, execute agentic tools, interact with MongoDB for conversational history, and enforce daily deep spend caps (`DEEP_DAILY_CAP=5`) and tool/time execution caps. It is completely isolated from the public internet and only accepts requests forwarded by the Gateway.
- **Background Worker**: The Worker is the **only** component that parses binary PDFs and generates chunk embeddings during document ingestion. It never handles user search requests or SSE streams.
- **Web UI**: Pure presentation layer. It possesses zero secrets, runs no database queries, and cannot communicate directly with the Agent service or external providers.

## Communication

Communication paths are chosen based on latency and decoupling requirements:
- **Browser ↔ Gateway**: Standard HTTP POST transitions immediately into Server-Sent Events (`text/event-stream`) for streaming search responses. The gateway flushes headers instantly with a 2KB warmup padding to defeat proxy buffering.
- **Gateway ↔ Agent**: Transparent HTTP proxying over loopback/private networking. Streaming responses are piped with `X-Accel-Buffering: no` and zero buffering to preserve TTFT under 2500ms. If the agent service crashes mid-stream, the gateway terminates the connection cleanly with a `502 Bad Gateway` rather than serving silent hallucinations.
- **Agent ↔ Background Worker**: Asynchronous queueing mediated exclusively via the MongoDB `jobs` collection. When a PDF is uploaded, the agent writes raw bytes to GridFS, inserts a `pending` job document, and responds immediately with `202 Accepted` (< 300ms). The worker claims jobs using atomic `findOneAndUpdate` with a lease timeout (`claimedAt`).
- **Agent ↔ External Providers**: Outbound HTTPS REST calls to Tavily and model APIs. Every call has bounded timeouts and adheres to a "fail-loud" policy: provider exceptions immediately terminate the run with `{ terminated: "error" }` and surface a 502, never returning false empty successes.

## State

State is strictly partitioned between authoritative persistent data and disposable operational caches:
- **Authoritative State (MongoDB Atlas)**: Thread histories (`threads`, `messages`), persistent user preferences (`memories`), document metadata and chunks (`spaces`, `documents`, `chunks`), and PDF binaries in GridFS. This data is permanent and must never be lost.
- **Ephemeral Cache State**: The in-process LRU cache and the MongoDB `searchCache` collection (keyed by SHA-256 of normalized query and provider with a 24h TTL) are completely disposable. Deleting both causes zero system failure; subsequent searches simply refetch from Tavily.
- **Consistency Story for Ingested Documents**: Document ingestion is staged (`pending` → `parsing` → `chunking` → `embedding` → `indexing` → `indexed`). Because Atlas Vector Search indexes update asynchronously in the cloud, inserting chunks into the database does not mean they are immediately searchable. A document only reaches `indexed` status after a "read-your-write" probe verifies that Atlas Vector Search can actually retrieve at least one of the newly inserted chunk IDs. Stale jobs (> 5 minutes unclaimed) are swept back to `pending`.

## Trade-offs

We made four intentional engineering trade-offs during development:
1. **Atlas Vector Search vs. Dedicated Vector Database (Qdrant / Pinecone)**: We chose MongoDB Atlas Vector Search to keep document metadata, conversation threads, and embeddings in a single database. This eliminated multi-database synchronization overhead and dual-database operational complexity. The sacrifice was living with the Atlas M0 free-tier limit of 3 search indexes and having to handle asynchronous index synchronization delay via read-your-write probes.
2. **MongoDB TTL Collection + LRU vs. Standalone Redis Cache**: We built a two-tier in-process LRU backed by a MongoDB TTL collection rather than deploying a separate Redis instance. This reduced hosting cost and removed an external infrastructure point of failure. The trade-off is that multiple horizontally-scaled agent instances cannot share the in-memory tier, falling back to the MongoDB tier for cross-node cache hits.
3. **Bounded Iterative ReAct Loop vs. Multi-Agent Swarms**: We chose a single iterative loop bounded by hard deterministic caps (quick: 8 calls / 90s, deep: 24 calls / 240s) rather than an open-ended multi-agent swarm. This guarantees strict compliance with latency and cost budgets ($0.05 quick / $0.35 deep). The trade-off is that complex non-linear investigation tasks cannot be delegated to independent parallel sub-agents.
4. **PDF Extraction via pdf-parse vs. Cloud OCR Services**: We used local node extraction (`pdf-parse`) rather than an external OCR service (like AWS Textract). This keeps document ingestion fast, free, and self-contained, but means scanned image-only PDFs cannot be indexed without true OCR capability. I am still evaluating whether adding a fallback OCR service is worth the extra latency and credential footprint.
