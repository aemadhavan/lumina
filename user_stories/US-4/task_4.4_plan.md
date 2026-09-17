# Task 4.4 Plan: Verify Cross-Thread Memory Recall and Deletion Behavior

## Metadata & Links
- **Parent Issue**: [FDE-77 (US-4: Semantic Long-Term Memory System)](https://linear.app/fdem/issue/FDE-77)
- **Subtask Issue**: [FDE-81 / FDE-32](https://linear.app/fdem/issue/FDE-81/task-44-verify-cross-thread-memory-recall-and-deletion-behavior)
- **Status**: Completed
- **Created**: 2026-09-16
- **Completed**: 2026-09-16
- **Target Files**:
  - `backend/agent/src/loop.ts`
  - `backend/agent/src/tools/memory.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Review bench  │     │ • Hook save in   │     │ • Thread A save  │     │ • Linear Done   │
│   memory tests  │     │   runQuickLoop   │     │ • Check GET /mem │     │ • Plan status   │
│ • Tool naming & │     │ • Hook recall in │     │ • Thread B recall│     │   updated       │
│   trace schema  │     │   runQuickLoop   │     │ • Trace check    │     │ • TASKS.md      │
│ • Grounding &   │     │ • Inject memory  │     │ • DELETE /mem/id │     │   checked       │
│   capping check │     │   into prompt    │     │ • Verify gone    │     │                 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Integrate long-term memory operations (`save_memory` and `recall_memory`) into the agent's Quick loop and verify cross-thread semantic memory continuity and deletion behavior:
1. When a user requests remembering a preference/fact in Thread A, the agent executes `save_memory`, emits a successful trace step, and stores the embedded document in MongoDB.
2. When the user initiates a separate query in Thread B, the agent executes `recall_memory`, emits a successful trace step, and injects recalled preferences into the LLM synthesis context.
3. When `DELETE /memory/:id` is invoked, the memory is deleted and subsequent requests confirm its absence.

---

## Acceptance Criteria
- [x] `runQuickLoop` executes `save_memory` and emits a trace step (`tool: 'save_memory', ok: true`) when preference save intent is detected.
- [x] `runQuickLoop` executes `recall_memory` and emits a trace step (`tool: 'recall_memory', ok: true`) on queries with `userId`.
- [x] Recalled memories are injected into the LLM system prompt so answers adhere to user preferences across distinct threads.
- [x] If query is a pure memory save instruction, answer gracefully confirms persistence with empty sources.
- [x] Functional test verifies the end-to-end multi-thread lifecycle matching `benchmark/bench.mjs`:
  - Step 1: Thread A saves preference (`"Remember this preference for all future answers: Always answer in British English..."`).
  - Step 2: `GET /memory` verifies new row.
  - Step 3: Thread B asks general question; verify trace contains `recall_memory` with `ok: true`.
  - Step 4: `DELETE /memory/:id` removes the row.
  - Step 5: `GET /memory` confirms row is gone.
- [x] Full workspace passes `npm run typecheck`.

---

## Validation Summary
- **Thread A Memory Persistence**: Thread A received `"Remember this preference for all future answers: Always answer in British English and keep answers under 100 words."`. Trace emitted `save_memory` with `ok: true` in 211 ms. `GET /memory` verified new row persisted with matching ID and text.
- **Thread B Cross-Thread Recall**: Brand new Thread B received `"What is the capital of Portugal?"`. Trace emitted `recall_memory` with `ok: true` (`recalled 1 relevant long-term preference(s)`). Recalled preference was injected into the prompt; assistant synthesized grounded response honoring user instructions.
- **Immediate Deletion & Absence**: Invoking `DELETE /memory/:id` returned `204 No Content`. Subsequent `GET /memory` confirmed the memory was completely removed.
- **Type Safety & Quality**: Full workspace `npm run typecheck` passed with 0 errors; `quality/check.mjs` passed with 0 errors across rules A1, A2, A3, B1, B2, B3.
