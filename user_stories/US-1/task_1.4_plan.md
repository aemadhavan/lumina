# Task 1.4: Author DESIGN.md Answering the 5 Mandatory System Design Questions

**Linear Reference**: [FDE-17](https://linear.app/fdem/issue/FDE-17) / [FDE-63](https://linear.app/fdem/issue/FDE-63)  
**Parent User Story**: [FDE-5 / FDE-59: US-1](https://linear.app/fdem/issue/FDE-5)  
**Status**: Completed  

---

## 1. Lifecycle Overview & Results

1. **Pre-flight & State Transition**: [DONE] Transitioned Linear issues `FDE-63` and `FDE-17` to `In Progress`.
2. **Deterministic Execution**:
   - Authored [DESIGN.md](file:///c:/projects/FDE/DESIGN.md) in root workspace addressing all 5 required system design questions:
     - `## Components`: Web UI, Edge Gateway (:8787), Agent Service (:8000), Background Worker, MongoDB Atlas (`lumina`), Search Cache (two-tier), and Run Logs (`runs/<requestId>.json`).
     - `## Responsibilities`: Strict security boundaries — Gateway is the only edge interface; Agent is private and the only component holding provider keys; Web UI has zero keys.
     - `## Communication`: Unbuffered SSE streaming for quick TTFT, fail-loud 502 error propagation, atomic MongoDB job leasing for async document ingestion.
     - `## State`: Authoritative MongoDB Atlas persistent data vs ephemeral caches; read-your-write probe consistency before documents reach `indexed` status.
     - `## Trade-offs`: 4 explicit trade-offs evaluated (Atlas Vector vs dedicated Qdrant/Pinecone, in-process LRU vs Redis, single agent loop vs multi-agent swarm, GridFS + Mongo queue vs AWS S3 + SQS).
3. **Automated Verification**:
   - Ran `eval/build-report.mjs` heading regex parser: verified all 5 sections present and cleanly parsed with zero warnings.
4. **Evidence Capture & Closure**: [DONE]
   - Checked off Task 0.6 in `TASKS.md`, completing Phase 0 (100%).
   - Transitioned `FDE-63` and `FDE-17` to `Done`.
   - Transitioned parent user story `US-1` (`FDE-5` / `FDE-59`) to `Done`.
