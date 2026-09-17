# Task 1.1: Unpack Monorepo Files into Workspace Root & Preserve Course Notes

**Linear Reference**: [FDE-14](https://linear.app/fdem/issue/FDE-14/task-11-unpack-monorepo-files-into-workspace-root-and-preserve-course) / [FDE-60](https://linear.app/fdem/issue/FDE-60)  
**Parent User Story**: [FDE-5 / FDE-59: US-1](https://linear.app/fdem/issue/FDE-5/us-1-system-architecture-scaffolding-and-system-design-document)  
**Status**: Completed  

---

## 1. Lifecycle Overview & State Machine

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. BACKLOG  │ ──> │2. IN PROGRESS│ ──> │3. VERIFYING  │ ──> │   4. DONE    │
│Linear status │     │  Copy files  │     │ Integrity &  │     │ Linear update│
│  validation  │     │Merge scripts │     │ preserve check│    │ TASKS.md tick│
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

Every task follows this 4-stage lifecycle to guarantee zero regressions, complete auditability, and synchronization across Linear and local docs:

1. **Pre-flight & State Transition**: Move Linear ticket (`FDE-14` / `FDE-60`) to `In Progress`; mark in local `TASKS.md`. [DONE]
2. **Deterministic Execution**: Run non-destructive file operations via scripted migration. [DONE]
3. **Automated Verification**: Run file tree and content integrity checks. [DONE]
4. **Evidence Capture & Closure**: Generate audit log in `walkthrough.md`, sync comment & status to Linear, and mark completed. [DONE]

---

## 2. Invariants & Red Lines (Non-Negotiables)

| File / Folder | Action | Status | Notes |
|---|---|---|---|
| `FDE-01-ClassNotes.docx` | **PRESERVE** | Preserved | 25,332 bytes, intact |
| `scripts/.linear_token` | **PRESERVE** | Preserved | 74 bytes, intact |
| `scripts/sync_to_linear.mjs` | **PRESERVE** | Preserved | 10,272 bytes, intact |
| `TASKS.md` & `user_stories/` | **PRESERVE** | Preserved | Tracking boards intact |
| `.agents/` | **PRESERVE** | Preserved | Antigravity rules & MCP configs intact |
| `Assignment_1_Lumina/scripts/*` | **MERGE** | Merged | Added `create-indexes.mjs`, `export-runs.mjs`, `indexes.json` |

---

## 3. Step-by-Step Execution Record

### Step 1: Linear Status Update
- Set `FDE-14` and `FDE-60` state to `In Progress`.

### Step 2: Source-to-Root File Migration
Source path:  
`c:\projects\FDE\repo_temp\modules\Module_1_Agent_Foundations_Harness_System_Design\Assignment_1_Lumina\`

Files moved to workspace root (`c:\projects\FDE\`):
- **Root Configuration**: `package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.mjs`, `docker-compose.yml`, `expectations.json`, `.env.example`, `.gitignore`
- **Documentation & Rubrics**: `PRD.md`, `SPEC.md`, `TECHNICAL.md`, `AGENTS.md`, `DESIGN.template.md`, `README.md`
- **Monorepo Packages**:
  - `backend/` (`backend/agent`, `backend/gateway`)
  - `packages/contract/`
  - `web/`
  - `benchmark/`
  - `eval/`
  - `quality/`
- **Scripts Directory Merge**:
  - Copied `create-indexes.mjs`, `export-runs.mjs`, `indexes.json` into `c:\projects\FDE\scripts\` alongside `.linear_token` and `sync_to_linear.mjs`.

### Step 3: Temporary Directory Cleanup
- Cleanly deleted `c:\projects\FDE\repo_temp\` after migration check.

---

## 4. Verification & Integrity Checklist

- [x] `FDE-01-ClassNotes.docx` exists and size is 25,332 bytes.
- [x] `scripts/.linear_token` exists and is non-empty.
- [x] `scripts/sync_to_linear.mjs` exists.
- [x] `scripts/create-indexes.mjs` exists.
- [x] `package.json` exists at root and lists workspaces: `["packages/contract", "backend/gateway", "backend/agent", "web"]`.
- [x] `packages/contract/package.json` exists.
- [x] `backend/agent/package.json` exists.
- [x] `backend/gateway/package.json` exists.
- [x] `web/package.json` exists.
- [x] `repo_temp` directory is removed.

---

## 5. Evidence Capture & Task Completion

- **Audit Trail**: Output of directory verification logged in `walkthrough.md`.
- **Linear Issue Closure**: Transitioned `FDE-14` and `FDE-60` to `Done` with verification summary.
- **Local Tracking**: Checked off Task 0.1 and Task 0.2 in [`TASKS.md`](file:///c:/projects/FDE/TASKS.md).
