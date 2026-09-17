# Implementation Plan: US-2 MongoDB Atlas Vector Search, Text & Cache Indexing

**Linear User Story**: [FDE-6 / FDE-64: US-2 MongoDB Atlas Vector Search, Text & Cache Indexing](https://linear.app/fdem/issue/FDE-6/us-2-mongodb-atlas-vector-search-text-and-cache-indexing)  
**Parent Project**: LUMINA  
**Priority**: Urgent (P1)  
**Goal**: Connect to the live MongoDB Atlas cluster `lumina` database, execute the automated index creator script (`scripts/create-indexes.mjs`), and poll the asynchronous search/vector index builders until all indexes report `READY` and `queryable: true`.

---

## 1. Scope & Acceptance Criteria

```
US-2: MongoDB Atlas Vector Search, Text & Cache Indexing
├── Task 2.1 (FDE-65 / FDE-18): Establish connection to MongoDB Atlas cluster (lumina db)
├── Task 2.2 (FDE-66 / FDE-19): Execute scripts/create-indexes.mjs for vector, text, and TTL indexes
└── Task 2.3 (FDE-67 / FDE-20): Verify async index build status via --status probe until queryable
```

### Acceptance Criteria:
1. **Connection Validation**: Confirm `MONGODB_URI` from `.env` connects to `lumina-cluster` database `lumina` with successful ping.
2. **Standard & TTL Indexes**:
   - `threads`: `userId_1_createdAt_-1`
   - `messages`: `threadId_1_createdAt_1`
   - `memories`: `userId_1_createdAt_-1`
   - `spaces`: `userId_1`
   - `documents`: `spaceId_1`, `userId_1_createdAt_-1`
   - `chunks`: `spaceId_1_docId_1`, `docId_1`
   - `searchCache`: `key_1` (unique), `expiresAt_1` (TTL: `SEARCH_CACHE_TTL_SECONDS` / 21600s)
   - `jobs`: `status_1_claimedAt_1`, `spaceId_1`
3. **Atlas Search & Vector Search Indexes (3 Allowed on M0 Free Tier)**:
   - `chunks_vector` (vectorSearch on `chunks`): 1536 dims, cosine similarity, filter field: `spaceId`.
   - `memories_vector` (vectorSearch on `memories`): 1536 dims, cosine similarity, filter field: `userId`.
   - `chunks_text` (search on `chunks`): full-text index on `text` field.
4. **Status Verification**:
   - `node scripts/create-indexes.mjs --status` polls until all 3 search indexes report queryable.

---

## 2. Step-by-Step Execution Plan

### Task 2.1: Connection Check
- Confirm `process.env.MONGODB_URI` ping succeeds against `lumina`.

### Task 2.2: Execute `scripts/create-indexes.mjs`
- Run `node scripts/create-indexes.mjs`.
- Confirm collection creation and standard index creation exit without fatal errors.
- Confirm submission of Atlas Search and Vector Search index build jobs to MongoDB Atlas.

### Task 2.3: Verification Probe
- Run `node scripts/create-indexes.mjs --status` periodically (Atlas vector indexes typically build in 30–60 seconds).
- Confirm all three search indexes report `(queryable)`.

---

## 3. Evidence Capture & Closure

- Record build times and status outputs in `user_stories/US-2/task_2.*_plan.md` and `walkthrough.md`.
- Check off Phase 1 in `TASKS.md` (0% $\rightarrow$ 100%).
- Post completion comments and transition `FDE-64`, `FDE-6`, and all subtasks to `Done`.
