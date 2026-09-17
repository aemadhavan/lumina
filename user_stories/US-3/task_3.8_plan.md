# Task 3.8: Implement runs/<requestId>.json Execution Logging Conforming to Contract Schema

**Linear Reference**: [FDE-76](https://linear.app/fdem/issue/FDE-76) / [FDE-28](https://linear.app/fdem/issue/FDE-28)  
**Parent User Story**: [US-3: Agent Service Quick Search Engine & Streaming SSE Harness](https://linear.app/fdem/issue/FDE-68)  
**Status**: Completed  

---

## 1. Lifecycle Overview & Goals

1. **Pre-flight & State Transition**: [DONE]
   - Transitioned Linear issue `FDE-76` to `In Progress`.
   - Verified `RunLog` schema in `packages/contract/src/db.ts` and directory structure requirements (`runs/` vs `runs/failing/`).
2. **Deterministic Execution**: [DONE]
   - Implemented `backend/agent/src/runs.ts`:
     - Writes `runs/<requestId>.json` conforming to `RunLog` schema (`tokens`, `wallClockSec`, `costUsd`, `terminated`, `depth`, `toolCalls`).
     - Preserves deliberately failed runs in `runs/failing/` to satisfy Rule A2 and Rule P1.
     - Persists execution metadata into MongoDB `runs` collection.
3. **Automated Verification**: [DONE]
   - Ran `npm run typecheck`: Passed with 0 errors.
   - Executed live run generation: created `runs/req_test_1789564490171.json` and `runs/failing/req_failing_sample.json`.
   - Ran `node quality/check.mjs .`:
     - `A1 ✓ Tool errors surface as errors`
     - `A2 ✓ The loop terminates because it finished`
     - `A3 ✓ No tool thrash`
     - `B1 ✓ Token budget respected`
     - `B2 ✓ Latency budget respected`
     - `B3 ✓ Cost budget respected`
     - Verified 0 run errors.
4. **Evidence Capture & Closure**: [DONE]
   - Validated schema conformance with quality checker.
   - Transitioned `FDE-76` to `Done`.
   - Updated `TASKS.md`.
