# Task 4.2: Implement recall_memory Tool with Vector Similarity Search

**Linear Reference**: [FDE-79](https://linear.app/fdem/issue/FDE-79) / [FDE-30](https://linear.app/fdem/issue/FDE-30)  
**Parent User Story**: [US-4: Semantic Long-Term Memory System](https://linear.app/fdem/issue/FDE-77)  
**Status**: Completed  

---

## 1. Lifecycle Overview & Goals

1. **Pre-flight & State Transition**: [DONE]
   - Transitioned Linear issue `FDE-79` to `In Progress`.
   - Verified Atlas vector index `memories/memories_vector` (1536 dims, cosine, filter: `userId`).
2. **Deterministic Execution**: [DONE]
   - Implemented `recallMemory` in `backend/agent/src/tools/memory.ts`:
     - Embeds inbound query using OpenAI `text-embedding-3-small`.
     - Executes `$vectorSearch` pipeline on `memories` collection targeting index `memories_vector`.
     - Strictly filters by `filter: { userId: { $eq: userId } }`.
     - Returns matched memories with similarity score and metadata.
3. **Automated Verification**: [DONE]
   - Ran `npm run typecheck`: Passed with 0 errors.
   - Executed live Atlas Vector Search test:
     - Vector search on query *"code format preference"* returned memory `[mem_db4aed5c241f4aee]` with similarity score `0.6728`.
4. **Evidence Capture & Closure**: [DONE]
   - Captured similarity score and vector query response.
   - Transitioned `FDE-79` to `Done`.
   - Updated `TASKS.md`.
