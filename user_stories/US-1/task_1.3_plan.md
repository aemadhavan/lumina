# Task 1.3: Configure .env with Environment Variables & Provider Keys

**Linear Reference**: [FDE-16](https://linear.app/fdem/issue/FDE-16) / [FDE-62](https://linear.app/fdem/issue/FDE-62)  
**Parent User Story**: [FDE-5 / FDE-59: US-1](https://linear.app/fdem/issue/FDE-5)  
**Status**: Completed  

---

## 1. Lifecycle Overview & Results

1. **Pre-flight & State Transition**: [DONE] Transitioned Linear issues `FDE-62` and `FDE-16` to `In Progress`.
2. **Deterministic Execution**:
   - Created root `.env` from `.env.example` defining database parameters (`lumina`), vector backend (`atlas-vector-search`), LLM settings (`anthropic`/`claude-sonnet-5`), search provider (`tavily`), embedding model (`text-embedding-3-small`), hard caps (quick: 8 calls / 90s, deep: 24 calls / 240s), ports (`PORT_GATEWAY=8787`, `PORT_AGENT=8000`), and CORS origins.
   - Enforced non-negotiable security boundaries: provider secrets are read exclusively in `backend/agent/src/env.ts` and never in gateway or web bundles.
3. **Automated Verification**:
   - Verified `.env` is covered by `.gitignore`.
   - Verified `backend/agent/dist/env.js` imports and parses configuration cleanly (port: 8000, db: lumina).
   - Verified `backend/gateway/dist/env.js` imports and parses configuration cleanly (port: 8787, agentUrl: http://localhost:8000).
4. **Evidence Capture & Closure**: [DONE]
   - Checked off Task 0.5 in `TASKS.md`.
   - Updated Linear descriptions and posted audit completion comment.
   - Transitioned `FDE-62` and `FDE-16` to `Done`.
