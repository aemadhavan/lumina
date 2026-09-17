# Task 2.2: Execute scripts/create-indexes.mjs for Vector, Text, and TTL Indexes

**Linear Reference**: [FDE-19](https://linear.app/fdem/issue/FDE-19) / [FDE-66](https://linear.app/fdem/issue/FDE-66)  
**Parent User Story**: [US-2: MongoDB Atlas Vector Search, Text & Cache Indexing](https://linear.app/fdem/issue/FDE-6)  
**Status**: Completed  

---

## 1. Lifecycle Overview & Goals

1. **Pre-flight & State Transition**: [DONE] Transitioned Linear issues `FDE-66` and `FDE-19` to `In Progress`.
2. **Deterministic Execution**:
   - Executed `node scripts/create-indexes.mjs` against live MongoDB Atlas cluster.
   - Created all required collections and standard B-tree indexes across `threads`, `messages`, `memories`, `spaces`, `documents`, `chunks`, `jobs`, `requests`, `runs`.
   - Created TTL index on `searchCache.expiresAt`.
   - Created Atlas Vector Search index on `chunks` (`chunks_vector`, 1536 dimensions, cosine similarity, filter: `spaceId`).
   - Created Atlas Vector Search index on `memories` (`memories_vector`, 1536 dimensions, cosine similarity, filter: `userId`).
3. **Automated Verification**:
   - Monitored build job creation: index build requests accepted by Atlas with exit code 0.
4. **Evidence Capture & Closure**: [DONE]
   - Updated Linear issue description and checklist.
   - Transitioned `FDE-66` and `FDE-19` to `Done`.
