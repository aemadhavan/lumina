# Task 3.3: Implement web_search and fetch_page Tools with Query Normalization

**Linear Reference**: [FDE-71](https://linear.app/fdem/issue/FDE-71) / [FDE-23](https://linear.app/fdem/issue/FDE-23)  
**Parent User Story**: [US-3: Agent Service Quick Search Engine & Streaming SSE Harness](https://linear.app/fdem/issue/FDE-68)  
**Status**: Completed  

---

## 1. Lifecycle Overview & Goals

1. **Pre-flight & State Transition**: [DONE]
   - Transitioned Linear issue `FDE-71` to `In Progress`.
   - Reviewed contract requirements for `web_search` and `fetch_page` tools, search providers (`tavily` and `serpapi`), and query normalization.
2. **Deterministic Execution**: [DONE]
   - Created `backend/agent/src/tools/web_search.ts`:
     - Query normalization (`normalizeQuery`): lowercase, trim, collapse whitespace.
     - SHA-256 hash calculation (`searchCacheKey`) over `(normalized query, provider)`.
     - Tavily API client with timeout and upstream error propagation.
     - SerpApi client fallback.
   - Created `backend/agent/src/tools/fetch_page.ts`:
     - HTML fetching with timeout and user-agent.
     - JSDOM and Mozilla Readability content parsing and cleaning.
   - Created `backend/agent/src/tools/index.ts` re-exporting tools.
3. **Automated Verification**: [DONE]
   - Ran `npm run typecheck`: Passed with 0 errors.
   - Executed live integration test:
     - Query normalization: `"  MongoDB Atlas   Vector Search  "` $\rightarrow$ `"mongodb atlas vector search"`.
     - Cache key generation: SHA-256 `2f1705bd3f343dc50e4ff8e768879467df8aa1c633ddc610328c88998aa0bce3`.
     - Live Tavily search: 2 search results retrieved.
     - Live page fetch: parsed article content and title using Readability.
4. **Evidence Capture & Closure**: [DONE]
   - Verified clean text extraction and error propagation.
   - Transitioned `FDE-71` to `Done`.
   - Updated `TASKS.md`.
