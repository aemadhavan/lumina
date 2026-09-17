# User Story 4 (US-4): Semantic Long-Term Memory System

**Linear Reference**: [FDE-77](https://linear.app/fdem/issue/FDE-77) / [FDE-8](https://linear.app/fdem/issue/FDE-8)  
**Parent Project**: LUMINA  
**Status**: Completed  

---

## 1. Subtasks & Implementation Status

| Linear Issue | Task Name | Status | Plan & Evidence |
| :--- | :--- | :--- | :--- |
| [FDE-78 / FDE-29](https://linear.app/fdem/issue/FDE-78) | Task 4.1: Implement `save_memory` tool using `text-embedding-3-small` stored with `userId` | Completed | [task_4.1_plan.md](task_4.1_plan.md) |
| [FDE-79 / FDE-30](https://linear.app/fdem/issue/FDE-79) | Task 4.2: Implement `recall_memory` tool with vector similarity search | Completed | [task_4.2_plan.md](task_4.2_plan.md) |
| [FDE-80 / FDE-31](https://linear.app/fdem/issue/FDE-80) | Task 4.3: Implement REST endpoints (`GET /memory`, `DELETE /memory/:id`) | Completed | [task_4.3_plan.md](task_4.3_plan.md) |
| [FDE-81 / FDE-32](https://linear.app/fdem/issue/FDE-81) | Task 4.4: Verify cross-thread memory recall and deletion behavior | Completed | [task_4.4_plan.md](task_4.4_plan.md) |

---

## 2. Key Architecture & Deliverables

- **Embedding Generation (`backend/agent/src/embeddings.ts`)**: Generates 1536-dimensional embeddings using OpenAI `text-embedding-3-small` with `OPENAI_API_KEY`.
- **Memory Persistence (`save_memory`)**: Persists extracted stable facts and preferences to `memories` collection matching contract `MemoryDoc` (`{ _id, userId, text, embedding, sourceThread, createdAt }`).
- **Semantic Recall (`recall_memory`)**: Queries MongoDB Atlas Vector Search index `memories_vector` using `$vectorSearch` filtered strictly by `userId`.
- **Memory Management API (`routes/memory.ts`)**:
  - `GET /memory`: Lists all saved memories for the authenticated `userId`.
  - `DELETE /memory/:id`: Deletes the target memory by ID, removing its effect from future searches.
- **Cross-Thread Persistence**: Preferences stated in Thread A are recalled and injected into Thread B without explicit referencing. Deleting via `DELETE /memory/:id` immediately stops recall in Thread C.
