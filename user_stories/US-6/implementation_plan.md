# Implementation Plan: User Story 6 (US-6) — Deep Search & Spend Gate

## Overview
Implement Perplexity-style Deep Research in LUMINA, enabling structured query decomposition, pre-retrieval planning, attributed multi-step fan-out, citation deduplication, structured answer synthesis, and strict daily spend control.

---

## 4-Stage Task Execution Breakdown

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Contract SSE  │     │ • plan_research  │     │ • Live deep run  │     │ • Subtasks Done │
│   events: plan, │     │   tool & prompt  │     │ • Plan precedes  │     │ • US-6 Done     │
│   trace, sources│     │ • deep_loop.ts   │     │   all retrieval  │     │ • Plans updated │
│ • Deep caps:    │     │ • subQuestion tag│     │ • Citations 1..N │     │ • TASKS.md      │
│   24 tools, 240s│     │ • Contiguous RRF │     │ • Deep/Quick >=2x│     │   updated       │
│ • Spend gate:   │     │ • DEEP_DAILY_CAP │     │ • 6th run -> 429 │     │ • 0 type errors │
│   DEEP_DAILY_CAP│     │   spend gate 429 │     │   with resetsAt  │     │                 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

### Subtasks:
1. **Task 6.1 (FDE-90)**: Implement `plan_research` tool (`backend/agent/src/tools/plan_research.ts`) generating 3 to 6 sub-questions with rationales using the LLM.
2. **Task 6.2 (FDE-91)**: Integrate Deep Search harness into `backend/agent/src/deep_loop.ts` and ensure `plan` SSE event is emitted **before** any search or retrieval tool executes. Enforce quick-mode red-line protection (quick mode never executes `plan_research`).
3. **Task 6.3 (FDE-92)**: Implement research fan-out in `deep_loop.ts` across sub-questions, tagging every `trace` step and `source` with `subQuestion: N`, and deduplicating citations into a single contiguous `[1..N]` numbering.
4. **Task 6.4 (FDE-93)**: Enforce the daily spend gate (`DEEP_DAILY_CAP` = 5) in `backend/agent/src/routes/threads.ts` per `X-User-Id` returning HTTP `429 Too Many Requests` with `{ error, resetsAt }`.
5. **Task 6.5 (FDE-94)**: Enforce hard budget caps (max 24 tool calls, max 240s wall-clock, max $0.35 cost) and verify deep search surfaces $\ge 2.0\times$ distinct sources compared to quick search on the same topic.
