# Task 6.1 Plan: Implement plan_research tool generating 3-6 sub-questions with rationales

## Metadata & Links
- **Parent Issue**: [FDE-89 (US-6: Deep Search & Spend Gate)](https://linear.app/fdem/issue/FDE-89)
- **Subtask Issue**: [FDE-90](https://linear.app/fdem/issue/FDE-90)
- **Status**: Completed (2026-09-17)
- **Target Files**:
  - `backend/agent/src/tools/plan_research.ts`
  - `backend/agent/src/tools/index.ts`

---

## 4-Stage Task Lifecycle

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Pre-flight    │ ──> │    Execution     │ ──> │    Validation    │ ──> │     Closure     │
│                 │     │                  │     │                  │     │                 │
│ • Contract      │     │ • Implement      │     │ • Unit test      │     │ • Linear Done   │
│   PlanEvent &   │     │   planResearch() │     │   with complex   │     │ • Plan status   │
│   SubQuestion   │     │ • Structured JSON│     │   query          │     │   updated       │
│   schemas       │     │   prompting via  │     │ • Verify 3-6     │     │ • 0 type errors │
│ • 3-6 questions │     │   LLM            │     │   sub-questions  │     │ • Ready for 6.2 │
│   constraint    │     │ • Validate zod   │     │   with reasons   │     │                 │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Objective
Implement `plan_research` in `backend/agent/src/tools/plan_research.ts`:
1. Use the LLM to analyze the user's root query and decompose it into 3 to 6 logical, non-overlapping sub-questions.
2. Each sub-question must carry an index `i: number` (1-based), `question: string`, and a concise rationale `reason: string`.
3. Validated against `@lumina/contract`'s `PlanEvent` schema:
   ```typescript
   export const SubQuestion = z.object({
     i: z.number().int().positive(),
     question: z.string().min(1),
     reason: z.string().optional()
   });
   export const PlanEvent = z.object({
     subQuestions: z.array(SubQuestion).min(2).max(8),
     reason: z.string().optional()
   });
   ```

---

## Acceptance Criteria
- [x] `planResearch` decomposes queries into 3 to 6 sub-questions with rationales.
- [x] Conforms strictly to contract `PlanEvent` schema.
- [x] Clean error handling if LLM output fails schema validation with fallback parsing.
- [x] Full workspace passes `npm run typecheck`.
