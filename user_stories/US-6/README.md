# User Story 6 (US-6): Deep Search (Pro Search) & Daily Spend Gate

**Linear Reference**: [FDE-89](https://linear.app/fdem/issue/FDE-89) / [FDE-10](https://linear.app/fdem/issue/FDE-10)  
**Parent Project**: LUMINA  
**Status**: Completed  

---

## 1. Subtasks & Implementation Status

| Linear Issue | Task Name | Status | Plan & Evidence |
| :--- | :--- | :--- | :--- |
| [FDE-90](https://linear.app/fdem/issue/FDE-90) | Task 6.1: Implement `plan_research` tool generating 3-6 sub-questions with rationales | Completed | [task_6.1_plan.md](task_6.1_plan.md) |
| [FDE-91](https://linear.app/fdem/issue/FDE-91) | Task 6.2: Stream `plan` event prior to any retrieval; strictly ban quick runs from `plan_research` | Completed | [task_6.2_plan.md](task_6.2_plan.md) |
| [FDE-92](https://linear.app/fdem/issue/FDE-92) | Task 6.3: Implement research fan-out, per-step `subQuestion` tagging, and merged contiguous citation numbering | Completed | [task_6.3_plan.md](task_6.3_plan.md) |
| [FDE-93](https://linear.app/fdem/issue/FDE-93) | Task 6.4: Enforce deep search daily limit `DEEP_DAILY_CAP` (5) returning `429 { error, resetsAt }` | Completed | [task_6.4_plan.md](task_6.4_plan.md) |
| [FDE-94](https://linear.app/fdem/issue/FDE-94) | Task 6.5: Enforce deep budget caps (24 tool calls, 240s wall clock, max $0.35 cost) and verify >= 2.0x distinct sources | Completed | [task_6.5_plan.md](task_6.5_plan.md) |

---

## 2. Architecture & Deliverables

1. **Query Decomposition & `plan_research` Tool**:
   - Decomposes complex queries into 3 to 6 logical sub-questions with concise, meaningful rationales.
   - Emits a `plan` SSE event **prior to any retrieval**.
   - Red-line guard: Quick search runs are strictly banned from calling `plan_research` or self-escalating into deep searches.
2. **Multi-Channel Research Fan-Out**:
   - Runs iterative retrieval across sub-questions.
   - Every `trace` event carries `subQuestion: N` index.
   - Every `source` item carries `subQuestion: N` attribution.
3. **Unified Citation Merging**:
   - Deduplicates sources by URL or `docId` + locator.
   - Renumbers contiguously `[1..N]` across all sub-questions.
   - Synthesizes a structured answer (direct summary, sub-question sections, remaining unknowns).
4. **Daily Spend Gate & Budget Caps**:
   - Enforces `DEEP_DAILY_CAP` (default 5) per `X-User-Id` in the agent service.
   - Exceeded cap immediately returns `429 Too Many Requests` with `{ error, resetsAt }`.
   - Hard execution limits: max 24 tool calls, max 240s wall-clock time, max $0.35 budget. Hitting a limit ends with `terminated: "cap"`.
