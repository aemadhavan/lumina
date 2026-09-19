# Product Requirements Document

# LUMINA for Singapore Legal

| Field | Value |
|---|---|
| Product | LUMINA for Singapore Legal |
| Parent | LUMINA (cited research agent: web + private documents, quick / deep) |
| Market | Singapore in-house legal and small commercial law practices |
| Status | Draft |
| Date | 19 September 2026 |
| Owner | Product |
| Audience | Engineering, design, legal, GTM |

This document specifies a **vertical product** on the LUMINA engine. It does not replace the assignment [`PRD.md`](../PRD.md) or [`SPEC.md`](../SPEC.md). Where this PRD and the LUMINA contract disagree on wire format, the contract in `packages/contract/` wins for the current codebase. New legal-only behaviour is additive.

---

## 1. Summary

LUMINA for Singapore Legal is a **cited research assistant for commercial legal work**. A lawyer asks a question, optionally over uploaded contracts or playbooks. The system searches allowed public sources and/or those documents, fetches real pages, and streams an answer in which every `[n]` opens something retrieved **in that request**.

It is **not** a Singapore legal research database. It does not replace LawNet, Singapore Statutes Online (SSO) as a citator, or the lawyer’s duty to verify. It is **not** for court filings.

**One-line:** Cited work over your contracts and Singapore public sources. Not LawNet. Not for filing.

---

## 2. Problem

Singapore in-house teams and small firms are already using ChatGPT and Copilot on vendor contracts and regulator circulars. That creates two failures:

1. **Hallucinated authority.** In *[2025] SGHCR 33* (*Tajudin bin Gulam Rasul v Suriaya bte Haja Mohideen*), counsel cited a fictitious AI-generated case. The citation number was real; the case was not. A LawNet search would have shown it. The court made a personal costs order. The Courts’ GenAI Guide (1 October 2024) already requires verification on SSO and the judgments portal, and forbids using one AI to confirm another.

2. **Confidentiality.** The Law Society advisory of 2 April 2026 warns that public AI tools can breach **PCR Rule 6**. MinLaw’s Guide (6 March 2026) tells practices to prefer enterprise tools, disable train-on-data, and anonymise before using consumer products. Axiom’s 2024 Singapore in-house survey found most teams understaffed and many without an AI policy.

LawNet 4.0 (with GPT-Legal on official content) owns **primary legal research**. Harvey and CoCounsel own large-firm workflows. The gap is the 1–10 person in-house team or 2–15 lawyer commercial SLP that needs:

- a clause-level reading of **their** PDFs, with page cites;
- a brief of **what MAS / PDPC / MOM / IMDA actually published**, with live URLs;
- a tool they can defend to a DPO and a managing partner.

---

## 3. Goals

1. **Ground every claim.** Every `[n]` resolves to a source retrieved in that request. Empty retrieval says so and cites nothing. Never invent a URL, a case name, a citation number, or a page.
2. **Stay on the allowed job.** Contracts, playbooks, and Singapore public sources. Refuse primary legal research and anything destined for a court paper.
3. **Make verification the default close.** Every answer reminds the user to check LawNet and SSO. The product never claims to have verified good law.
4. **Protect confidentiality.** No client or personal data in consumer-model defaults. Visible memory, deletable rows, retention the admin can explain.
5. **Keep cost bounded.** Quick is the default. Deep is opt-in. The server never upgrades depth. Daily deep cap stays enforced in the agent service.
6. **Fail loud.** Provider exceptions are `502` / `terminated: "error"`. Caps are `terminated: "cap"` with an honest partial. Never a plausible silent answer.

---

## 4. Non-goals

| Out of scope | Why |
|---|---|
| Singapore case-law research, KeyCite / Shepard’s equivalent, “is this good law?” | LawNet / SAL. Courts Guide: verify on official sources, not another AI. |
| Drafting or checking court documents (SGHCR, OS, affidavits, submissions) | [2025] SGHCR 33; personal costs and discipline. |
| Legal advice | Product is an aid. Lawyer remains accountable (MinLaw Guide; PCR). |
| Matter management, time billing, eLitigation filing | Different category. |
| Voice, slide decks, image generation | LUMINA non-goals; they crowd out the loop. |
| Browsing that clicks or fills forms | Search + fetch + read only. |
| Fine-tuning a Singapore-law model | Provider-swappable models + retrieval. |
| Replacing LawNet AI or Harvey | Complement. Different job. |

---

## 5. Users

### 5.1 Primary — In-house counsel (beachhead)

- **Who:** GC or legal lead at an 80–800 person Singapore company or APAC HQ (tech, fintech, PE portfolio, consumer). Often 1–4 lawyers.
- **Job:** Review vendor/customer paper; answer the business on “what did MAS / PDPC say?”; keep playbooks consistent.
- **Trigger:** A near-miss paste into ChatGPT, a board asking for an AI policy, or [2025] SGHCR 33 circulating internally.
- **Success:** A PDPA / liability / governing-law table from five MSAs, or a regulator brief with openable .gov.sg links, in under 15 minutes — then they verify.

### 5.2 Secondary — Small commercial SLP

- **Who:** Managing partner or associate at a 2–15 lawyer Singapore Law Practice. Corporate, commercial, employment. Not a litigation boutique.
- **Job:** Same as in-house, plus first-pass on client *templates* (not live privileged files until Phase 2).
- **Constraint:** PCR Rule 6 and Cloud GN 3.4.1. Will ask where the file is stored on call one.

### 5.3 Anti-persona

- Litigation counsel preparing a bundle of authorities.
- Magic Circle / Big 4 / large local firm with Harvey + LawNet already bought.
- Anyone who wants “safe to file.”

### 5.4 Other roles

| Role | Need |
|---|---|
| DPO / InfoSec | PDPA DPA, residency disclosure, no-train, deletion, audit log |
| Managing partner | Cost cap, refuse-list they can show clients |
| Paralegal / legal ops | Upload, Space hygiene, export of the clause table |

---

## 6. Regulatory requirements (product constraints)

These are **requirements**, not legal advice. The product must be operable under them.

| Instrument | Date | Product implication |
|---|---|---|
| Courts GenAI Guide | 1 Oct 2024 | Banner + footer: verify on SSO and the judgments portal. Do not offer “AI confirmed this cite.” |
| [2025] SGHCR 33 | 2025 | Refuse case-citation jobs. Fail loud on empty retrieval. Never invent a citation number. |
| MinLaw GenAI Guide | 6 Mar 2026 | Human in the loop. Enterprise posture. Transparency if use is substantial. RAG with citations. |
| Law Society advisory | 2 Apr 2026 | Paid / enterprise only. No train-on-data. Anonymise until DPA exists. Cyber hygiene. |
| PCR Rule 6 / SCCA ethics | Standing | Confidentiality. Memory and Spaces must be inspectable and deletable. |
| PDPA | Standing | No NRIC or unnecessary personal data in pilots. DPA before live client files. |
| Law Society Cloud GN 3.4.1 | Standing | Disclose region of Atlas, object storage, and model providers. Do not claim “data stays in Singapore” unless it does. |

---

## 7. Product principles

Inherited from LUMINA, restated for this vertical:

1. **Grounded or nothing.** A citation that does not resolve to something retrieved in that request is a defect, whether or not the legal proposition happens to be true.
2. **Fail loud.** No `try/catch` that returns a plausible memo when the provider threw.
3. **Bounded and honest.** Quick and deep caps. `terminated` is `done`, `cap`, or `error`.
4. **Refused jobs are a feature.** Lawyers buy constraint. Publish and enforce the refuse list.
5. **Verification is outside the product.** LUMINA retrieves and cites. LawNet and SSO verify. One AI must never “confirm” another.

---

## 8. Jobs to be done

### JTBD-1 — Vendor / customer contract compare (P0)

Upload 3–10 MSAs or NDAs (PDF / text). Ask: compare PDPA, liability cap, termination, assignment, governing law. Answer is a structured table. Every cell cites `filename, p. N`.

### JTBD-2 — Regulator scan (P0)

Ask: what did MAS / PDPC / MOM / IMDA publish on X this quarter? System fetches official pages. Answer lists instruments with URLs and dates. Deep plan lists 3–6 sub-questions before retrieval.

### JTBD-3 — Statute-aware commercial brief (P0)

Ask how a clause sits against a named Act on SSO (e.g. PDPA, Companies Act). System may fetch `sso.agc.gov.sg`. Footer: this is not advice; confirm on SSO.

### JTBD-4 — Playbook Q&A (P1)

Upload internal templates (redacted). Ask “how do we usually handle DPA addenda?” Answer cites the playbook page. Long-term memory stores **firm preferences** (jurisdiction default, preferred cap language), never live client facts.

### JTBD-5 — Hybrid follow-up (P1)

After a docs answer: “and what has PDPC said since?” Blend Space + allowed web. One citation numbering, docs and web distinct.

### Explicitly refused (P0)

- “Find Singapore cases on…”
- “Is this still good law?”
- “Draft / check submissions, affidavits, or a bundle of authorities.”
- “Cite SGHCR / SGCA / unreported for a filing.”

Refusal copy must name the duty: verify on LawNet and SSO; the Courts Guide does not allow one AI to confirm another.

---

## 9. Functional requirements

Priority: **P0** = MVP (pilot-ready). **P1** = first paid cohort. **P2** = scale.

### 9.1 Inherited from LUMINA (already specified)

These must keep working. Legal-specific behaviour layers on top.

| ID | Requirement | Priority |
|---|---|---|
| L-1 | Agent loop: plan → tool → observe → repeat. Tools: `web_search`, `fetch_page`, `search_documents`, `recall_memory`, `save_memory`; `plan_research` on **deep only**. | P0 |
| L-2 | Stream `trace → sources → token → done`. Deep: `plan` first, before any retrieval. `sources` before first `token`. | P0 |
| L-3 | Every `[n]` matches exactly one source from that request. Dedupe by URL or `docId` + locator. Contiguous numbering from 1. | P0 |
| L-4 | `depth` defaults to `quick`. Server never upgrades. Deep daily cap → `429 {error, resetsAt}`. | P0 |
| L-5 | Empty retrieval: say so, cite nothing. | P0 |
| L-6 | Spaces: async upload `202`, worker parse/chunk/embed, **indexed only after read-your-write probe**. Locator `{page}` for PDF. | P0 |
| L-7 | Memory listed at `GET /memory`, deleted at `DELETE /memory/{id}`. Nothing remembered that the panel does not show. | P0 |
| L-8 | Run log per answer: tokens, cost, `terminated`, `depth`, ordered tool calls. | P0 |
| L-9 | `X-Request-Id` end to end. Gateway and agent log it. | P0 |
| L-10 | File too large → `413`. Unknown ids → `404`. No `X-User-Id` → `401`. Upstream fail → `502`. | P0 |

### 9.2 Singapore Legal — policy and routing

| ID | Requirement | Priority |
|---|---|---|
| SG-1 | **Product mode.** A Singapore Legal workspace (or equivalent flag) applies the refuse list, allowlist, and banners without changing the LUMINA contract event shapes. | P0 |
| SG-2 | **Refuse classifier** runs before retrieval. Matching the refused jobs in §8 returns a structured refusal (not a 502): reason, what to use instead (LawNet, SSO), no invented cites. | P0 |
| SG-3 | **Source allowlist** for `web_search` / `fetch_page` in this mode. Default hosts: `sso.agc.gov.sg`, `www.mas.gov.sg`, `www.pdpc.gov.sg`, `www.mom.gov.sg`, `www.imda.gov.sg`, `www.mlaw.gov.sg`, `www.judiciary.gov.sg`, `www.acra.gov.sg`, `www.lawsociety.org.sg`. Fetch off-list only if the user explicitly opts into “wider web” for that thread. | P0 |
| SG-4 | **Jurisdiction lock.** Answers assume Singapore law unless the user names another. Do not silently mix foreign holdings as if they were SG authority. | P0 |
| SG-5 | **Persistent banners** on ask, answer, and export: not legal advice; not for filing; verify on LawNet and SSO; one AI cannot verify another. | P0 |
| SG-6 | **Structured legal answer** for P0 jobs: direct answer → table or section per issue → sources → “still unknown / not retrieved.” Deep answers keep a section per sub-question. | P0 |
| SG-7 | **No case-looking strings invented.** If the model would emit a reporter cite (`[202x] SG*`, `SGHC`, `SGCA`, `MLJ`, etc.) that is not in retrieved text, strip or refuse that span. | P0 |

### 9.3 Documents and Spaces

| ID | Requirement | Priority |
|---|---|---|
| SG-8 | **Space types:** `vendor-paper`, `playbook`, `regulator-pack`, `restricted`. Default new Space is `vendor-paper`. `restricted` is disabled until Phase 2 ACL. | P0 |
| SG-9 | **Upload gate.** Before first file: checklist — redacted? no NRIC? no live client name? user confirms. | P0 |
| SG-10 | **Supported files** remain PDF, Markdown, plain text, ≤ 25 MB. Page locators required on PDF chunks. | P0 |
| SG-11 | **Clause-table intent.** Queries that ask to compare named clause types return a markdown table: clause × document × excerpt + `[n]`. | P0 |
| SG-12 | **Matter walls.** Documents in Space A are never retrievable from Space B. Phase 2: matterId + user role, not only `spaceId`. | P0 / P2 |
| SG-13 | **Export.** Copy or download the answer + sources as Markdown or DOCX. Footer includes banners and request id. | P1 |
| SG-14 | **Anonymise assist.** Optional pre-upload pass that flags emails, NRIC-like tokens, and “Client:” lines. Does not claim PDPA-complete redaction. | P2 |

### 9.4 Memory

| ID | Requirement | Priority |
|---|---|---|
| SG-15 | `save_memory` in this mode stores **preferences and playbook rules only** (e.g. “prefer Singapore governing law”). Reject memories that look like client facts, NRIC, or matter names. | P0 |
| SG-16 | Memory panel copy: “Firm preferences. Not client files. Delete any row that should not persist.” | P0 |
| SG-17 | Org admin can wipe all memories for a userId. | P1 |

### 9.5 Search and deep research

| ID | Requirement | Priority |
|---|---|---|
| SG-18 | Prefer fetching the **canonical .gov.sg / SSO URL**, not a news remix, when both appear. | P0 |
| SG-19 | Deep plan for regulator jobs must include: (1) official instrument, (2) date / status, (3) what it applies to, (4) what is still unknown. 3–6 sub-questions. | P0 |
| SG-20 | Search cache key remains SHA-256(normalised query, provider). `searchCached: true` only if **every** search in the request hit. TTL must not outlive a stated “as at” date on regulator pages without showing cache age. | P1 |
| SG-21 | **Verify-on-SSO chip** on statute-like sources: deep-link to the SSO page that was fetched. Do not deep-link a generated “LawNet search” as if it were a result. | P1 |

### 9.6 Trust, identity, admin

| ID | Requirement | Priority |
|---|---|---|
| SG-22 | **Disclosure page** (in-product): model vendor, search vendor, vector store, **data regions**, retention, train-on-data status. `/health` already names model, search, vector, db — extend the human-readable page. | P0 |
| SG-23 | **No-train.** Provider settings and contract: inputs not used to train. Documented in the disclosure page. If a provider cannot honour this, it is not selectable in Singapore Legal mode. | P0 |
| SG-24 | **Audit export.** For a date range: requestId, userId, query hash (not raw query by default), tools, sources, terminated, cost. Raw query included only if admin role + reason logged. | P1 |
| SG-25 | Replace `X-User-Id` header-as-identity with real auth (SSO / magic link) before any non-redacted client file. | P1 |
| SG-26 | Org: seats, Space ACL, retention days, deep daily cap. | P2 |
| SG-27 | Customer DPA (PDPA) and subprocessors list. | P1 |

---

## 10. User scenarios

**A — Monday vendor pack (P0).** Mei, sole in-house at a 200-person fintech, drops five redacted MSAs into Space `Q3 vendors`. Asks Quick: “Compare PDPA, liability cap, governing law.” Trace shows `search_documents` only. Sources rail lists `acme-msa.pdf, p. 12`. She clicks `[2]` and sees the cap. Banner remains visible.

**B — PDPC scan (P0).** Mei flips Deep: “What has PDPC published on accountability since 2024?” Plan streams 4 sub-questions **before** any fetch. Sources are pdpc.gov.sg and SSO only. Answer has a “still unknown” line. Footer tells her to confirm on SSO.

**C — Refused research (P0).** An associate asks “Give me Singapore cases on restraint of trade for a HC brief.” No retrieval. Refusal names LawNet, [2025] SGHCR 33, and the Courts Guide. Zero case-looking strings.

**D — Preference memory (P1).** Mei: “Remember we default to Singapore law and a 12-month cap in vendor paper.” Memory panel shows that row. Next thread’s clause table flags English-law drafts. She deletes the row; the effect disappears.

**E — Fail loud (P0).** Tavily is down. Stream ends with error / `502`. No memo that “looks fine.” `/stats` and the run log show `terminated: "error"`.

**F — Cheap default (P0).** “What is the URL for Singapore Statutes Online?” Quick. One fetch. No plan. Low cost.

---

## 11. UX requirements

- Keep the existing LUMINA surfaces: query, quick/deep, stream, citation chips, sources rail, plan panel, trace, threads, memory, Spaces, `/stats`.
- Add, without breaking the contract:
  - Singapore Legal workspace badge.
  - Persistent legal banners (SG-5).
  - Space type on create (SG-8).
  - Upload checklist (SG-9).
  - Refusal card (SG-2) with “Open LawNet” / “Open SSO” as links to the **official homepages**, not to fabricated results.
  - Disclosure / residency page (SG-22).
- Citation chips for documents show **filename + page**. Web chips show **host + title**. Off-allowlist hosts are visually distinct if wider-web is on.
- Do not add a “Generate authorities” or “File-ready brief” control.

---

## 12. Non-functional requirements

| Area | Requirement |
|---|---|
| Grounding | Same bar as LUMINA: unresolved `[n]` is a ship-blocker. |
| Latency | Quick commercial / docs questions should stay in the existing SLA envelope (`benchmark/sla.json` remains the numeric authority for the engine). Deep regulator scans may use the deep budget (tool-call and wall-clock caps unchanged). |
| Cost | Quick default. Deep cap per user per day. Show cost on `done` and `/stats`. |
| Security | Secrets only in the agent service. No keys in the browser. TLS in transit. |
| Privacy | PDPA-aligned processing. No train-on-data. Deletion of Spaces, documents, memories, threads. |
| Residency | Publish actual regions. Prefer Singapore-region Atlas and a region-disclosed model. If any hop is outside SG, the disclosure page says so. |
| Availability | Fail loud over fail silent. Partial on `cap`. |
| Audit | One requestId greppable gateway → agent → run log. |
| Accessibility | Existing UI contrast and keyboard paths; banners must not be colour-only. |

---

## 13. Data and retention

| Data | Store (LUMINA today) | Legal-mode rule |
|---|---|---|
| Threads / messages | Mongo `threads`, `messages` | Retention days configurable (P1). Export + delete. |
| Uploaded files | GridFS | Redacted-only until SG-25. Delete with document. |
| Chunks + embeddings | `chunks` + vector index | `spaceId` filter inside `$vectorSearch`. No cross-Space leak. |
| Memories | `memories` | Preferences only (SG-15). |
| Search cache | LRU + `searchCache` TTL | No raw client document text in cache keys. |
| Run logs | `runs/<requestId>.json` or Mongo | Admin audit (SG-24). |

Do not log full document text or NRIC to application logs.

---

## 14. Success metrics

Declare targets before a pilot; do not back-fit after seeing scores.

| Metric | Pilot target | Notes |
|---|---|---|
| Citation resolve rate | 100% of `[n]` in sampled answers | Same grounding rule as LUMINA |
| Refuse-list precision | ≥ 95% of case-law / filing prompts refused with no retrieval | Sampled weekly |
| Allowlist adherence | 100% of fetches on allowlist unless user opted into wider web | Logged |
| Time-to-first-cited-brief | Median ≤ 15 min for JTBD-1 on 5 PDFs already indexed | User-observed |
| Pilot reuse | ≥ 2 of 3 design partners run a second contract set | GTM gate |
| Deep used only when opted | 0 silent upgrades | Existing bench check |
| Confidentiality incidents | 0 known live-client uploads in Phase 0 | Checklist + review |

Vanity metrics (raw query count, “AI tokens”) are not success.

---

## 15. Release plan

### Phase 0 — Policy MVP (current engine)

Ship without changing `packages/contract/` or `web/` if those remain frozen for the assignment. Implement in the agent:

- Singapore Legal system prompt, refuse list, allowlist, banners in the generated answer body.
- Memory write filter (SG-15).
- Disclosure text (regions, no-train) on a static page or `/health` companion.

**Exit:** three design-partner demos on redacted vendor paper + one PDPC/MAS Deep question. No case-law demo.

### Phase 1 — Paid cohort

- SG-2 classifier as a hard pre-loop gate (not prompt-only).
- Auth beyond `X-User-Id`.
- Export + audit export.
- PDPA DPA and subprocessors.
- Cache age on regulator answers.

### Phase 2 — Firm-ready

- Matter ACL, admin wipe, anonymise assist, DOCX, org seats.
- Singapore-region deployment story that matches the disclosure page.
- Optional “wider web” toggle per thread.

### Phase 3 — Distribution

- Law Society / SCCA CLE motion, not LawNet replacement.
- Explore PSG-Legal **only if** the product is actually listable. Do not promise the grant in sales copy before that.
- Out of scope forever: citator, eLitigation, “safe to file.”

---

## 16. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| User treats cites as verified law | Sanctions, brand death | Refuse list, banners, no case-looking inventions, CLE messaging |
| Live client file in US-region Atlas | PCR 6 / Cloud GN / PDPA | Phase 0 redaction gate; honest residency page; SG region before unredacted files |
| Prompt-only refusal is jailbroken | Fake authorities in the UI | Phase 1 hard classifier; output filter SG-7 |
| Allowlist too tight | Missed IMDA consultation on a new host | Documented wider-web opt-in; review host list quarterly |
| Allowlist too loose | News site “cites” a fake case | Default official hosts only |
| Grounding ≠ correct legal reading | Wrong commercial decision | “Still unknown” section; human in the loop; not advice |
| Assignment freeze on `web/` | Banners only in answer text | Phase 0 accepts that; Phase 1 may need a legal UI fork **outside** frozen folders |

---

## 17. Open questions

1. Is the first commercial entity a new app (legal workspace) or a mode flag on the existing LUMINA deploy?
2. Which model providers will sign no-train + region disclosure in writing for a 3-seat pilot?
3. Will design partners accept GridFS-in-Atlas in a disclosed foreign region for **redacted** vendor paper?
4. Do we need a human legal reviewer on the refuse-list and allowlist (yes for Phase 1 — who)?
5. Is Malay / Chinese contract text in scope for Phase 2, or English only?

---

## 18. Appendix A — Allowed public hosts (Phase 0 default)

- `sso.agc.gov.sg`
- `www.mas.gov.sg`
- `www.pdpc.gov.sg`
- `www.mom.gov.sg`
- `www.imda.gov.sg`
- `www.mlaw.gov.sg`
- `www.judiciary.gov.sg`
- `www.acra.gov.sg`
- `www.lawsociety.org.sg`

Additions require a written change to this appendix, not a silent prompt edit.

## 19. Appendix B — Sources used for this PRD

- LUMINA [`PRD.md`](../PRD.md), [`SPEC.md`](../SPEC.md), `packages/contract/`
- Singapore Courts Guide on Generative AI Tools by Court Users (1 October 2024)
- *[2025] SGHCR 33*
- MinLaw, *Guide for Using Generative AI in the Legal Sector* (6 March 2026)
- Law Society of Singapore, advisory on publicly available AI tools (2 April 2026)
- SAL LawNet 4.0 public materials
- Axiom, 2024 Singapore In-House Counsel Survey (staffing / AI policy)

---

## 20. Appendix C — Requirement index (quick)

| ID | One line |
|---|---|
| L-1–L-10 | Engine contract: loop, stream, grounding, gears, Spaces, memory, logs, errors |
| SG-1–SG-7 | Mode, refuse, allowlist, jurisdiction, banners, structure, no invented cites |
| SG-8–SG-14 | Space types, upload gate, clause table, ACL, export, anonymise |
| SG-15–SG-17 | Preference-only memory |
| SG-18–SG-21 | Official-source preference, deep plan shape, cache age, SSO chip |
| SG-22–SG-27 | Disclosure, no-train, audit, auth, org admin, DPA |
