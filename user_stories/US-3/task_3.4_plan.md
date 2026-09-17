# Task 3.4: Implement Two-Tier Search Cache (In-Memory LRU + MongoDB searchCache TTL)

**Linear Reference**: [FDE-72](https://linear.app/fdem/issue/FDE-72) / [FDE-24](https://linear.app/fdem/issue/FDE-24)  
**Parent User Story**: [US-3: Agent Service Quick Search Engine & Streaming SSE Harness](https://linear.app/fdem/issue/FDE-68)  
**Status**: Completed  

---

## 1. Lifecycle Overview & Goals

1. **Pre-flight & State Transition**: [DONE]
   - Transitioned Linear issue `FDE-72` to `In Progress`.
   - Reviewed contract schema `SearchCacheDoc` and TTL configuration.
2. **Deterministic Execution**: [DONE]
   - Implemented `backend/agent/src/cache.ts`:
     - In-memory `LRUCache<K, V>` with configurable capacity (default 1000) and TTL.
     - Integration with MongoDB `searchCache` collection (with TTL index).
     - Keying: SHA-256 of `(normalized query, provider)`.
     - Read path: Tier 1 (LRU) $\rightarrow$ Tier 2 (MongoDB `searchCache` collection) $\rightarrow$ cache miss.
     - Automatic LRU cache repopulation upon MongoDB Tier 2 cache hit.
     - `cachedWebSearch`: transparent wrapper reporting `cached: boolean` and `tier?: 'lru' | 'mongo'`.
3. **Automated Verification**: [DONE]
   - Ran `npm run typecheck`: Passed with 0 errors.
   - Executed live multi-tier cache lifecycle test:
     - Step 1: Initial query $\rightarrow$ `cached: false` (miss) $\rightarrow$ writes to LRU and MongoDB.
     - Step 2: Immediate repeat $\rightarrow$ `cached: true, tier: lru` (Tier 1 hit).
     - Step 3: Evicted LRU $\rightarrow$ `cached: true, tier: mongo` (Tier 2 hit).
     - Step 4: Follow-up query $\rightarrow$ `cached: true, tier: lru` (repopulated LRU hit).
4. **Evidence Capture & Closure**: [DONE]
   - Validated complete cache tiering and TTL expiration compliance.
   - Transitioned `FDE-72` to `Done`.
   - Updated `TASKS.md`.
