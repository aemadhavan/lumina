# Task 3.6: Implement Unbuffered SSE Streaming (POST /threads/:id/ask) with Sources Preceding Tokens

**Linear Reference**: [FDE-74](https://linear.app/fdem/issue/FDE-74) / [FDE-26](https://linear.app/fdem/issue/FDE-26)  
**Parent User Story**: [US-3: Agent Service Quick Search Engine & Streaming SSE Harness](https://linear.app/fdem/issue/FDE-68)  
**Status**: Completed  

---

## 1. Lifecycle Overview & Goals

1. **Pre-flight & State Transition**: [DONE]
   - Transitioned Linear issue `FDE-74` to `In Progress`.
   - Reviewed contract rules for SSE streaming:
     - Route: `POST /threads/:threadId/ask`.
     - Event sequence: `trace`* $\rightarrow$ `sources` $\rightarrow$ `token`* $\rightarrow$ `done`.
     - Strict contract invariant: `sources` event MUST be emitted before the first `token` event.
     - Unbuffered headers: `text/event-stream`, `no-cache, no-transform`, `X-Accel-Buffering: no`, immediate flushing.
2. **Deterministic Execution**: [DONE]
   - Implemented streaming SSE handler in `backend/agent/src/routes/threads.ts`:
     - Extracted and forwarded `x-user-id` and `x-request-id`.
     - Configured unbuffered SSE response headers.
     - Streamed real-time `trace` events during web retrieval and page fetching.
     - Streamed `sources` event prior to token generation.
     - Streamed chunked `token` events from LLM completion.
     - Streamed final `done` event containing complete server-side metrics.
3. **Automated Verification**: [DONE]
   - Ran `npm run typecheck`: Passed with 0 errors across all 4 packages.
   - Executed live E2E streaming test:
     - Verified `Content-Type: text/event-stream`.
     - Verified `sources` event emitted before first `token`: `sourcesBeforeToken: true`.
     - Verified `DoneEvent` strictly satisfies schema:
       ```json
       {
         "answerId": "ans_790f263c535f46de",
         "costUsd": 0.01066,
         "terminated": "done",
         "depth": "quick"
       }
       ```
     - Verified grounding: 100% of citation numbers `[n]` in generated text resolve to sources.
4. **Evidence Capture & Closure**: [DONE]
   - Captured streaming events trace and confirmed contract invariant satisfaction.
   - Transitioned `FDE-74` to `Done`.
   - Updated `TASKS.md`.
