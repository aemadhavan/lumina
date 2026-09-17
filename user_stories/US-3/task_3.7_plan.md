# Task 3.7: Implement Thread and Message Persistence (POST/GET/DELETE /threads)

**Linear Reference**: [FDE-75](https://linear.app/fdem/issue/FDE-75) / [FDE-27](https://linear.app/fdem/issue/FDE-27)  
**Parent User Story**: [US-3: Agent Service Quick Search Engine & Streaming SSE Harness](https://linear.app/fdem/issue/FDE-68)  
**Status**: Completed  

---

## 1. Lifecycle Overview & Goals

1. **Pre-flight & State Transition**: [DONE]
   - Transitioned Linear issue `FDE-75` to `In Progress`.
   - Verified thread and message contract schemas: `CreateThreadBody`, `CreateThreadResponse`, `GetThreadResponse`, `ListThreadsResponse`, `ThreadDoc`, `MessageDoc`.
2. **Deterministic Execution**: [DONE]
   - Implemented thread management endpoints in `backend/agent/src/routes/threads.ts`:
     - `POST /threads`: Creates thread, assigns `thr_...` id, saves `ThreadDoc`.
     - `GET /threads`: Lists threads scoped by `userId`, ordered by `createdAt` desc.
     - `GET /threads/:threadId`: Fetches thread details with full message history.
     - `DELETE /threads/:threadId`: Cascades deletion across `threads` and `messages`.
     - `GET /threads/:threadId/messages`: Returns turn history for thread.
     - History injection: Prior user/assistant messages injected into LLM context on follow-up questions.
3. **Automated Verification**: [DONE]
   - Ran `npm run typecheck`: Passed with 0 errors.
   - Executed live E2E test:
     - `POST /threads` created `thr_mu44hpxey045zt`.
     - `GET /threads` verified thread existence.
     - Follow-up message retrieval verified 2 turns: Role 0 (`user`), Role 1 (`assistant`).
     - `DELETE /threads/:threadId` returned 200 and deleted messages.
4. **Evidence Capture & Closure**: [DONE]
   - Verified end-to-end CRUD and history injection.
   - Transitioned `FDE-75` to `Done`.
   - Updated `TASKS.md`.
