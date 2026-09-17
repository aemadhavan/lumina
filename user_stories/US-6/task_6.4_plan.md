# Task 6.4 Plan: Enforce deep search daily limit DEEP_DAILY_CAP (5) returning 429 { error, resetsAt }

## Metadata & Links
- **Parent Issue**: [FDE-89 (US-6: Deep Search & Spend Gate)](https://linear.app/fdem/issue/FDE-89)
- **Subtask Issue**: [FDE-93](https://linear.app/fdem/issue/FDE-93)
- **Status**: Completed
- **Created**: 2026-09-17
- **Target Files**:
  - `backend/agent/src/routes/threads.ts`
  - `backend/agent/src/routes/stats.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • DEEP_DAILY_CAP│     │ • Count today's  │     │ • Test 5 deep    │     │ • Linear Done   │
│   env (def: 5)  │     │   deep requests  │     │   calls succeed  │     │ • Plan status   │
│   (not gateway) │     │   resetsAt (UTC  │     │   429 & resetsAt │     │ • 0 type errors │
│                 │     │   midnight)      │     │ • /stats matches │     │ • Ready for 6.5 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Implement daily spend limit enforcement for deep search queries:
1. Enforce in the **agent service** (`backend/agent/src/routes/threads.ts`), NOT solely at the gateway:
   - *"Not in the gateway: a cap on the edge is a cap you bypass by reaching the agent service directly."* (AGENTS.md)
2. Daily Tracking:
   - Count deep requests for the given `userId` created since UTC midnight today.
   - Use `requests` collection or `runs` collection filtered by `userId`, `depth: 'deep'`, and `createdAt >= todayUtcMidnight`.
3. Rejection & Payload:
   - If count >= `env.deepDailyCap` (default 5):
     - Return HTTP `429 Too Many Requests`.
     - JSON body: `{ error: 'deep search daily limit reached', resetsAt: <nextMidnightIso>, status: 429 }`.
4. Endpoint Alignment:
   - Ensure `/stats` accurately reports `deepToday` and `deepDailyCap` reconciled with database records.

---

## Acceptance Criteria
- [x] Deep searches check count against `DEEP_DAILY_CAP` (default: 5) in agent service.
- [x] Once limit is reached, returns HTTP 429 with `{ error, resetsAt }`.
- [x] `resetsAt` specifies the next UTC midnight timestamp.
- [x] Quick searches are unaffected by the deep cap.
- [x] Full workspace passes `npm run typecheck`.
