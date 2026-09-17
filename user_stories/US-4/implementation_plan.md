# Implementation Plan: US-4 Semantic Long-Term Memory System

**Parent Issue**: [US-4: Semantic Long-Term Memory System](https://linear.app/fdem/issue/FDE-77)  
**Related Linear Issues**: [FDE-8](https://linear.app/fdem/issue/FDE-8), [FDE-29](https://linear.app/fdem/issue/FDE-29) through [FDE-32](https://linear.app/fdem/issue/FDE-32), [FDE-78](https://linear.app/fdem/issue/FDE-78) through [FDE-81](https://linear.app/fdem/issue/FDE-81)  
**Status**: Completed (100%)  
**Goal**: Implement semantic long-term memory extraction, persistence, and recall across conversation threads using OpenAI embeddings (`text-embedding-3-small`) and MongoDB Atlas Vector Search (`memories_vector`), along with memory management REST endpoints (`GET /memory`, `DELETE /memory/:id`).

---

## 1. Subtask Execution Roadmap

```
user_stories/US-4/
├── Task 4.1 (FDE-78 / FDE-29): Implement save_memory tool using text-embedding-3-small stored with userId
├── Task 4.2 (FDE-79 / FDE-30): Implement recall_memory tool with vector similarity search
├── Task 4.3 (FDE-80 / FDE-31): Implement REST endpoints (GET /memory, DELETE /memory/:id)
└── Task 4.4 (FDE-81 / FDE-32): Verify cross-thread memory recall and deletion behavior
```

---

## 2. Component Design & Technical Specifications

### Component 1: OpenAI Embedding Service (`backend/agent/src/embeddings.ts`)
- Calls OpenAI Embeddings API (`https://api.openai.com/v1/embeddings`) with model `text-embedding-3-small`.
- Generates 1536-dimensional vector embedding for given text string.
- Validates embedding length strictly matches contract `EMBEDDING_DIMS = 1536`.

### Component 2: Memory Tools (`backend/agent/src/tools/memory.ts`)
- **`save_memory`**:
  - Arguments: `{ text: string }`.
  - Generates 1536-dim embedding.
  - Inserts into `memories` collection matching `MemoryDoc` schema: `{ _id, userId, text, embedding, sourceThread, createdAt }`.
  - Emits `trace` event with `tool: 'save_memory'`, `ok: true`.
- **`recall_memory`**:
  - Arguments: `{ query: string, limit?: number }`.
  - Generates embedding for `query`.
  - Performs MongoDB Atlas Vector Search aggregation:
    ```javascript
    [
      {
        $vectorSearch: {
          index: 'memories_vector',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: 20,
          limit: limit ?? 3,
          filter: { userId }
        }
      },
      {
        $project: {
          _id: 1,
          text: 1,
          createdAt: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ]
    ```
  - Emits `trace` event with `tool: 'recall_memory'`, `ok: true`.

### Component 3: Memory REST Endpoints (`backend/agent/src/routes/memory.ts`)
- **`GET /memory`**:
  - Authenticates `X-User-Id` (401 without it).
  - Fetches all documents from `memories` collection matching `{ userId }` sorted by `createdAt: -1`.
  - Returns `{ memories: [{ memoryId: d._id, text: d.text, createdAt: d.createdAt }] }` matching `ListMemoriesResponse`.
- **`DELETE /memory/:memoryId`**:
  - Authenticates `X-User-Id` (401 without it).
  - Deletes document matching `{ _id: memoryId, userId }`.
  - Returns `{ ok: true }` if deleted, `404` if not found.

### Component 4: Agent Loop Integration (`backend/agent/src/loop.ts`)
- At start of quick reasoning loop, executes `recall_memory` for the user's question to retrieve relevant user preferences/facts.
- If relevant memories exist, injects them into system instructions: `User Profile & Preferences: ...`.
- If user explicitly states a preference (e.g., "Remember that I prefer TypeScript"), calls `save_memory`.

---

## 3. Verification Plan

1. **Automated Unit & Integration Tests**:
   - `test_embeddings.ts`: Verify 1536-dim embedding generation.
   - `test_save_recall.ts`: Save memory in Thread A, verify presence in `memories` collection.
   - `test_atlas_vector_search.ts`: Perform `$vectorSearch` against live `memories_vector` index.
2. **Cross-Thread Verification**:
   - Save preference in Thread A: *"I prefer Python over JavaScript"*.
   - Start fresh unlinked Thread B: *"What language should I use for my backend?"*.
   - Verify Thread B recalls memory from Thread A and recommends Python.
3. **Deletion Verification**:
   - Call `DELETE /memory/:id`.
   - Start Thread C: verify deleted preference is no longer recalled.
4. **Contract & Quality Gates**:
   - Verify with `npm run typecheck`.
   - Verify `quality/check.mjs` runs.
