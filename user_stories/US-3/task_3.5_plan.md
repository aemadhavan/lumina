# Task 3.5: Implement Quick ReAct Agent Loop with Hard Caps (8 Tool Calls, 90s) and Fail-Loud Semantics

**Linear Reference**: [FDE-73](https://linear.app/fdem/issue/FDE-73) / [FDE-25](https://linear.app/fdem/issue/FDE-25)  
**Parent User Story**: [US-3: Agent Service Quick Search Engine & Streaming SSE Harness](https://linear.app/fdem/issue/FDE-68)  
**Status**: Completed  

---

## 1. Lifecycle Overview & Goals

1. **Pre-flight & State Transition**: [DONE]
   - Transitioned Linear issue `FDE-73` to `In Progress`.
   - Reviewed contract rules for Quick ReAct loop:
     - Tools allowed: `web_search`, `fetch_page`, `search_documents`, `recall_memory`, `save_memory`. (`plan_research` is strictly prohibited in quick mode).
     - Caps: max 8 tool calls, max 90s wall-clock time $\rightarrow$ terminates with `terminated: "cap"`.
     - Fail loud: upstream provider exceptions fail with `terminated: "error"` and HTTP 502.
     - Trace logging: every step recorded with `step`, `tool`, `input`, `ok`, `ms`, and `error` if `ok === false`.
2. **Deterministic Execution**: [DONE]
   - Created `backend/agent/src/llm.ts`:
     - Multi-provider LLM caller supporting Gemini (`gemini-3.6-flash`), Anthropic, and OpenAI.
     - Streaming generation support with chunk callback.
   - Created `backend/agent/src/loop.ts`:
     - Implemented `runQuickLoop` enforcing hard caps (8 tool calls, 90s).
     - Coordinated `web_search` $\rightarrow$ `fetch_page` $\rightarrow$ grounded source creation.
     - Tracked `searchCached` flag (true only if every search was cached).
     - Streamed LLM tokens to callback.
     - Returned execution telemetry matching `DoneEvent` and `RunLog`.
3. **Automated Verification**: [DONE]
   - Ran `npm run typecheck`: Passed with 0 errors across all workspaces.
   - Executed live Quick ReAct test on query *"What is MongoDB Atlas Vector Search?"*:
     - `[TRACE 1] web_search (ok: true, 1997ms): retrieved 5 results from tavily`
     - `[TRACE 2] fetch_page (ok: true, 975ms): fetched 10200 chars: Spotlight: Evaluating MongoDB Atlas Vector Search`
     - `[TRACE 3] fetch_page (ok: true, 1910ms): fetched 1808 chars: MongoDB Vector Search`
     - `[SOURCES] Emitted 2 sources BEFORE first token`
     - `DoneEvent schema validation: PASSED`
     - Grounding verification: Found citations `[1, 2, 1, 2]`. 100% matched retrieved sources.
4. **Evidence Capture & Closure**: [DONE]
   - Validated streaming callbacks, caps, fail-loud handling, and contract schema compliance.
   - Transitioned `FDE-73` to `Done`.
   - Updated `TASKS.md`.
