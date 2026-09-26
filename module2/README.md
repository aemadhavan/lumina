# 🚀 Production Agentic RAG: Dynamic Router, RBAC, Sub-Query Division & Semantic Caching

[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![Qdrant](https://img.shields.io/badge/Vector_DB-Qdrant-red.svg)](https://qdrant.tech/)
[![OpenAI](https://img.shields.io/badge/LLM-GPT--4o_/_GPT--5.6--Luna-green.svg)](https://openai.com/)
[![SerpApi](https://img.shields.io/badge/Live_Search-SerpApi-yellow.svg)](https://serpapi.com/)
[![Project Status](https://img.shields.io/badge/Status-100%25_Verified-success.svg)](#)

An enterprise-ready **Agentic Retrieval-Augmented Generation (RAG)** system that introduces reasoning, security boundaries, and multi-query decomposition prior to retrieval and synthesis.

Rather than funneling every query into a static RAG pipeline, this system exhibits true **agency**: deciding which specialized knowledge store to query, enforcing role-based permissions before retrieval, decomposing compound questions into independent sub-queries, and caching responses without cross-role data leaks.

---

## 🏗️ Architecture & Decision Workflow

```
                             ┌─────────────────────┐
                             │     User Query      │
                             └──────────┬──────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │   Identity & Role Check     │
                         │    (Unknown -> DENIED)      │
                         └──────────────┬──────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │  Sub-Query Decomposition    │
                         │   sub_queries() Engine      │
                         └──────────────┬──────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │ (Per Sub-Question Routing Loop)       │
                    ▼                                       ▼
       ┌─────────────────────────┐             ┌─────────────────────────┐
       │   Agentic Query Router  │             │   RBAC Security Gate    │
       │   route_query() (LLM)   │ ──────────► │  has_access(user, role) │
       └─────────────────────────┘             └────────────┬────────────┘
                                                            │
                     ┌──────────────────────────────────────┼──────────────────────────────────────┐
                     │                                      │                                      │
                     ▼ (Authorized)                         ▼ (Authorized)                         ▼ (Authorized)
       ┌───────────────────────────┐          ┌───────────────────────────┐          ┌───────────────────────────┐
       │       OPENAI_QUERY        │          │    10K_DOCUMENT_QUERY     │          │      INTERNET_QUERY       │
       │   Qdrant: `opnai_data`    │          │     Qdrant: `10k_data`    │          │      Live Google Search   │
       │   nomic-embed-text-v1.5   │          │   nomic-embed-text-v1.5   │          │          (SerpApi)        │
       └─────────────┬─────────────┘          └─────────────┬─────────────┘          └─────────────┬─────────────┘
                     │                                      │                                      │
                     └──────────────────────┬───────────────┴──────────────────────────────────────┘
                                            │
                                            ▼
                             ┌─────────────────────────────┐
                             │  Composite Answer Synthesizer│
                             │  (Preserves Citations [1])  │
                             └──────────────┬──────────────┘
                                            │
                                            ▼
                             ┌─────────────────────────────┐
                             │  Role-Aware Semantic Cache  │
                             │ (Stores in role partition)  │
                             └──────────────┬──────────────┘
                                            │
                                            ▼
                             ┌─────────────────────────────┐
                             │       Final Response        │
                             └─────────────────────────────┘
```

---

## 🌟 Key Features

### 1. 🧠 Agentic Query Router
- Dynamically classifies user intent into three specialized routes using a structured JSON prompt:
  - `OPENAI_QUERY`: OpenAI APIs, Agent frameworks, models, and guardrails.
  - `10K_DOCUMENT_QUERY`: Lyft 2024 & Uber 2021 SEC financial filings.
  - `INTERNET_QUERY`: Real-time web search for current events, tech trends, and cross-provider comparisons.
- Includes defensive regex-based JSON extraction that recovers from markdown blocks or provider formatting anomalies.

### 2. 🛡️ Role-Based Access Control (RBAC)
- **Security-First Principle**: Gates access *before* any embedding or vector search call is triggered.
- **Allow-Lists**:
  - `alice` (Engineer): Permitted to access `OPENAI_QUERY` and `INTERNET_QUERY`; blocked from `10K_DOCUMENT_QUERY`.
  - `bob` (Finance Analyst): Permitted to access `OPENAI_QUERY` and `10K_DOCUMENT_QUERY`; blocked from `INTERNET_QUERY`.
  - `carol` (Unknown): Rejected immediately before routing.

### 3. 🧩 Defensive Sub-Query Decomposition (Part 1 - Required)
- Splits compound, multi-intent queries into focused, independent sub-questions:
  - *"What was Lyft's 2021 revenue and what was Uber's 2021 revenue?"* $\rightarrow$ 2 independent 10-K sub-queries.
  - *"What was Uber's 2021 revenue and what are the newest LLMs?"* $\rightarrow$ 1 10-K sub-query + 1 Internet sub-query.
- **Fast-path optimization**: Single-intent questions pass directly without unnecessary multi-query synthesis overhead.

### 4. 🔗 Citation-Preserving Composite Synthesis
- Dispatches each sub-query independently (supporting cross-domain retrieval across Qdrant and SerpApi simultaneously).
- Synthesizes all sub-answers into a structured, unified response.
- **Strict Provenance**: 100% preservation of bracketed citations (`[1]`, `[2]`) from SEC filings and external URLs from Google Search.

### 5. ⚡ Role-Aware Semantic Caching (Bonus)
- **The Data Leak Vulnerability**: Naive semantic caches keyed only on query text will happily serve a cached financial answer to unauthorized roles without running RBAC checks.
- **The Solution**: **Partitioned Caching** (`self.partitions[role]`) using cosine distance threshold ($<0.2$) on 768-dimensional dense embeddings.
- **Strict Pipeline**:
  $$\text{Identity} \longrightarrow \text{Route} \longrightarrow \text{RBAC Gate} \longrightarrow \text{Cache Check} \longrightarrow \text{Pipeline}$$
- Fully verified with `run_self_check()` proving **zero cross-role data leaks**.

---

## 📊 Verification & Benchmark Matrix

| Test Scenario | Query | Sub-Queries & Routes | Output / Benchmark | Status |
|---|---|---|---|---|
| **Single Query** | *"what was uber revenue in 2021?"* | 1 Sub-Q $\rightarrow$ `10K_DOCUMENT_QUERY` | Fast-pathed directly $\rightarrow$ **$17.455 billion [1]** | ✅ Passed |
| **Compound (Same-Domain)** | *"what was lyft revenue in 2021 and what was uber revenue in 2021"* | 2 Sub-Qs $\rightarrow$ Both to `10K_DOCUMENT_QUERY` | Unified synthesis: **Lyft ($4.095B [1]) & Uber ($17.455B [1])** | ✅ Passed |
| **Compound (Cross-Domain)** | *"what was uber's 2021 revenue and what are the newest LLMs?"* | Sub-Q 1 $\rightarrow$ `10K`<br>Sub-Q 2 $\rightarrow$ `INTERNET_QUERY` | Merged financial metrics and live Google Search results with all 5 source URLs preserved | ✅ Passed |
| **RBAC Security** | Alice queries 10-K / Bob queries Web | Access gated prior to tool call | Access Denied returned before vector search runs | ✅ Passed |
| **Cache Anti-Leak** | Bob caches finance data $\rightarrow$ Alice asks same question | Partitioned lookup | Alice receives `DENIED`; Bob's answer never leaks | ✅ Passed |
| **End-to-End Notebook** | All 50 cells in `001. Agentic Router.ipynb` | Top-to-bottom run | Clean execution with all outputs populated | ✅ Passed |

---

## 📁 Repository Structure

```text
├── 001. Agentic Router.ipynb        # Complete, executed notebook with all 50 cell outputs
├── agentic_rag_presentation.pptx    # Widescreen presentation (ready for Google Slides)
├── slides.html                      # Interactive browser slide presentation
├── requirements.txt                 # Pinned dependencies
├── rag_helpers.py                   # Vector & cache helper routines
├── test_us02.py                     # SerpApi live internet tool test suite
├── test_us03.py                     # Agentic query router test suite
├── test_us04.py                     # Qdrant retrieval & citation generation test suite
├── test_us05.py                     # Baseline agentic_rag orchestrator loop test
├── test_us06.py                     # RBAC gatekeeper validation test
├── test_us07.py                     # Defensive sub-query decomposition test
├── test_us08.py                     # Multi-route execution & citation synthesis test
└── test_us10.py                     # Role-aware semantic cache anti-leak self-check
```

---

## 🚀 Quickstart & Reproduction

### 1. Clone the Repository
```bash
git clone https://github.com/aemadhavan/production-agentic-rag.git
cd production-agentic-rag
```

### 2. Set Up Virtual Environment & Dependencies
```bash
# Using uv (recommended)
uv venv .venv --python 3.12
uv pip install -r requirements.txt matplotlib python-pptx

# Activate environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate
```

### 3. Configure Credentials
Create a `.env` file in the root directory:
```env
OPENAI_API_KEY=sk-...
SERP_API_KEY=your_serpapi_key
```

### 4. Run Verification Suite
```bash
python test_us08.py   # Run Part 1 Multi-Agent Synthesis Tests
python test_us10.py   # Run Bonus Role-Aware Cache Anti-Leak Tests
```

### 5. Launch Slides
Open `slides.html` in your browser:
```powershell
Start-Process slides.html
```

---

## 🎓 Course Attribution
- **Course**: Module 3: Production Agentic RAG AI Systems
- **Author/Instructor**: Hamza Farooq ([multi-agent-course](https://github.com/hamzafarooq/multi-agent-course))
- **Tracked On**: [GitHub Project #5 (FDE)](https://github.com/users/aemadhavan/projects/5)
