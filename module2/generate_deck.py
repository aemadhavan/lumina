import sys
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5) # 16:9 Widescreen

    # Color Palette: Deep Slate Dark Theme
    COLOR_BG = RGBColor(15, 23, 42)        # Slate 900
    COLOR_CARD = RGBColor(30, 41, 59)      # Slate 800
    COLOR_BORDER = RGBColor(51, 65, 85)    # Slate 700
    COLOR_PRIMARY = RGBColor(56, 189, 248) # Sky 400 (Cyan)
    COLOR_ACCENT = RGBColor(129, 140, 248) # Indigo 400
    COLOR_SUCCESS = RGBColor(74, 222, 128) # Emerald 400
    COLOR_TEXT_MAIN = RGBColor(248, 250, 252) # Slate 50
    COLOR_TEXT_MUTED = RGBColor(148, 163, 184) # Slate 400

    def set_slide_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
        bg.fill.solid()
        bg.fill.fore_color.rgb = COLOR_BG
        bg.line.fill.background()
        return bg

    def add_header(slide, title_text, category="PRODUCTION AGENTIC RAG"):
        # Category Tag
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.35))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = COLOR_PRIMARY

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.7), Inches(0.8))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.size = Pt(24)
        p_title.font.bold = True
        p_title.font.color.rgb = COLOR_TEXT_MAIN

    def add_card(slide, left, top, width, height, title="", body_bullets=None, border_color=COLOR_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = COLOR_CARD
        card.line.color.rgb = border_color
        card.line.width = Pt(1.5)

        tb = slide.shapes.add_textbox(left + Inches(0.25), top + Inches(0.2), width - Inches(0.5), height - Inches(0.4))
        tf = tb.text_frame
        tf.word_wrap = True

        if title:
            p_t = tf.paragraphs[0]
            p_t.text = title
            p_t.font.size = Pt(16)
            p_t.font.bold = True
            p_t.font.color.rgb = COLOR_PRIMARY
            p_t.space_after = Pt(10)

        if body_bullets:
            for idx, b in enumerate(body_bullets):
                p = tf.add_paragraph() if (title or idx > 0) else tf.paragraphs[0]
                p.text = f"•  {b}"
                p.font.size = Pt(13)
                p.font.color.rgb = COLOR_TEXT_MAIN
                p.space_after = Pt(8)

        return card

    # ==========================================
    # SLIDE 1: Title Slide
    # ==========================================
    s1 = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(s1)

    tb1 = s1.shapes.add_textbox(Inches(1.2), Inches(1.8), Inches(11), Inches(4))
    tf1 = tb1.text_frame
    tf1.word_wrap = True

    p_badge = tf1.paragraphs[0]
    p_badge.text = "MODULE 3: PRODUCTION AGENTIC RAG AI SYSTEMS"
    p_badge.font.size = Pt(14)
    p_badge.font.bold = True
    p_badge.font.color.rgb = COLOR_PRIMARY
    p_badge.space_after = Pt(14)

    p_main = tf1.add_paragraph()
    p_main.text = "From Plan to Implementation:\nAgentic Router & Sub-Query Division"
    p_main.font.size = Pt(36)
    p_main.font.bold = True
    p_main.font.color.rgb = COLOR_TEXT_MAIN
    p_main.space_after = Pt(18)

    p_sub = tf1.add_paragraph()
    p_sub.text = "A complete engineering walkthrough: Architecture, Agile Stories, Hybrid Retrieval, RBAC Security & Role-Aware Semantic Caching."
    p_sub.font.size = Pt(16)
    p_sub.font.color.rgb = COLOR_TEXT_MUTED

    # ==========================================
    # SLIDE 2: Executive Summary & The Core Challenge
    # ==========================================
    s2 = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(s2)
    add_header(s2, "Executive Summary: Moving from Static to Agentic RAG")

    add_card(s2, Inches(0.8), Inches(1.8), Inches(3.7), Inches(5.0),
        title="1. The Problem with Static RAG",
        body_bullets=[
            "Single static pipeline treats every query identically.",
            "Cannot decide where information lives (docs vs finance vs live web).",
            "Fails on compound queries requiring multi-domain sources.",
            "Lacks identity awareness and security boundary enforcement."
        ]
    )

    add_card(s2, Inches(4.8), Inches(1.8), Inches(3.7), Inches(5.0),
        title="2. The Agentic Solution",
        body_bullets=[
            "Agency: Reasoning precedes retrieval and generation.",
            "LLM-powered Router dynamically dispatches to specialized stores.",
            "Role-Based Access Control (RBAC) gates access prior to search.",
            "Compound query decomposition into parallel sub-tasks."
        ],
        border_color=COLOR_PRIMARY
    )

    add_card(s2, Inches(8.8), Inches(1.8), Inches(3.7), Inches(5.0),
        title="3. Assignment Deliverables",
        body_bullets=[
            "Part 1 (Required): sub_queries decomposition, multi-route execution, and citation preservation.",
            "Bonus: RoleAwareSemanticCache with zero cross-role data leaks.",
            "Execution: 100% test-verified notebook executed top-to-bottom."
        ],
        border_color=COLOR_SUCCESS
    )

    # ==========================================
    # SLIDE 3: System Architecture
    # ==========================================
    s3 = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(s3)
    add_header(s3, "System Architecture: End-to-End Decision & Retrieval Flow")

    add_card(s3, Inches(0.8), Inches(1.8), Inches(5.6), Inches(2.4),
        title="1. Router Agent (LLM Brain)",
        body_bullets=[
            "Uses gpt-5.6-luna / GPT-4o with structured JSON schema.",
            "Evaluates query intent and emits action: OPENAI_QUERY, 10K_DOCUMENT_QUERY, or INTERNET_QUERY.",
            "Includes defensive regex parser to handle malformed outputs."
        ]
    )

    add_card(s3, Inches(6.8), Inches(1.8), Inches(5.6), Inches(2.4),
        title="2. Security Gatekeeper (RBAC)",
        body_bullets=[
            "Evaluates user role against strict allow-lists before any tool call.",
            "Alice (Engineer): allowed Docs + Internet; blocked from 10-K.",
            "Bob (Finance Analyst): allowed Docs + 10-K; blocked from Internet.",
            "Unknown users rejected immediately."
        ]
    )

    add_card(s3, Inches(0.8), Inches(4.5), Inches(5.6), Inches(2.4),
        title="3. Hybrid Retrieval Engine",
        body_bullets=[
            "Qdrant Vector DB: nomic-embed-text-v1.5 embeddings for opnai_data and 10k_data.",
            "SerpApi Tool: Google Search fetching direct answers and top 5 organic result snippets.",
            "Async connection handling with nest_asyncio."
        ]
    )

    add_card(s3, Inches(6.8), Inches(4.5), Inches(5.6), Inches(2.4),
        title="4. Synthesis & Grounding",
        body_bullets=[
            "Grounded response generator citing source chunks as [1], [2].",
            "Multi-query synthesizer merging disparate sub-answers into one cohesive response.",
            "Guarantees 100% preservation of all citations and links."
        ],
        border_color=COLOR_SUCCESS
    )

    # ==========================================
    # SLIDE 4: Agile Planning on GitHub Projects
    # ==========================================
    s4 = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(s4)
    add_header(s4, "Engineering Plan: 10 User Stories across GitHub Project #5")

    add_card(s4, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
        title="Phase 1 & 2: Core Infrastructure",
        body_bullets=[
            "US-01 (#2): Environment, API credentials, Qdrant stores & Nomic embeddings.",
            "US-02 (#3): Live Internet tool with SerpApi structured extraction.",
            "US-03 (#4): LLM-powered query router with JSON error recovery.",
            "US-04 (#5): Qdrant vector retrieval and [1], [2] citation generator.",
            "US-05 (#6): Baseline agentic_rag orchestrator loop."
        ]
    )

    add_card(s4, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
        title="Phase 3 & 4: Security & Assignment Core",
        body_bullets=[
            "US-06 (#7): Role-Based Access Control gatekeeper.",
            "US-07 (#8): Defensive sub-query decomposition engine.",
            "US-08 (#9): Multi-route execution & citation synthesis (Part 1 Core).",
            "US-09 (#10): End-to-end notebook execution & verification.",
            "US-10 (#11): Role-Aware Semantic Caching & anti-leak self-check."
        ],
        border_color=COLOR_PRIMARY
    )

    # ==========================================
    # SLIDE 5: Deep Dive: Sub-Query Decomposition (Part 1)
    # ==========================================
    s5 = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(s5)
    add_header(s5, "Part 1 Deep Dive: Defensive Sub-Query Decomposition")

    add_card(s5, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
        title="The Decomposition Strategy",
        body_bullets=[
            "Prompt design instructs LLM to output strict JSON: {'subQuestions': [...]}.",
            "Evaluates whether query has multiple distinct intents or is single-topic.",
            "Defensive Parsing Architecture:",
            "  1. Strips markdown fences (```json ... ```).",
            "  2. Regex scans for root JSON object {.*}.",
            "  3. Validates non-empty question list.",
            "  4. Fallback: on any error, safely returns [original_query]."
        ]
    )

    add_card(s5, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
        title="Verification Against Test Matrix",
        body_bullets=[
            "Single Query Test:",
            "  'what was uber revenue in 2021?' -> 1 sub-query (Fast-pathed).",
            "Same-Domain Compound Test:",
            "  'what was lyft revenue in 2021 and what was uber revenue in 2021' -> 2 sub-queries, both routed to 10K_DOCUMENT_QUERY.",
            "Cross-Domain Compound Test:",
            "  'what was uber's 2021 revenue and what are the newest LLMs?' -> 2 sub-queries: 10K_DOCUMENT_QUERY + INTERNET_QUERY."
        ],
        border_color=COLOR_SUCCESS
    )

    # ==========================================
    # SLIDE 6: Deep Dive: Multi-Route Execution & Synthesis
    # ==========================================
    s6 = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(s6)
    add_header(s6, "Part 1 Deep Dive: Multi-Route Execution & Synthesis")

    add_card(s6, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
        title="Execution Engine (agentic_rag_multi)",
        body_bullets=[
            "Step 1: Decompose compound query via split_query.",
            "Step 2: Fast-path single questions directly to agentic_rag without extra LLM synthesis overhead.",
            "Step 3: Route and execute each sub-query independently:",
            "  - Sub-queries legitimately land on different sources.",
            "  - Handlers execute with async/sync isolation.",
            "Step 4: Collect per-sub-query results into structured context blocks."
        ]
    )

    add_card(s6, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
        title="Citation-Preserving Synthesis",
        body_bullets=[
            "Non-Negotiable Requirement: All citations ([1], [2], URLs) must be preserved in the composite output.",
            "Dedicated Synthesizer Prompt:",
            "  - Blends disparate sub-answers into one cohesive structure.",
            "  - Uses markdown headings and bulleted financial metrics.",
            "  - Retains organic web links alongside SEC filing citations.",
            "Eliminates hallucination by constraining to retrieved context."
        ],
        border_color=COLOR_PRIMARY
    )

    # ==========================================
    # SLIDE 7: Deep Dive: Role-Based Access Control (RBAC)
    # ==========================================
    s7 = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(s7)
    add_header(s7, "Security: Role-Based Access Control Gatekeeper")

    add_card(s7, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
        title="RBAC Architecture & Allow-Lists",
        body_bullets=[
            "Role Definition (Identity Provider abstraction):",
            "  - alice: engineer",
            "  - bob: finance_analyst",
            "  - carol: unknown user (immediate rejection)",
            "Permission Allow-Lists:",
            "  - engineer: {OPENAI_QUERY, INTERNET_QUERY}",
            "  - finance_analyst: {OPENAI_QUERY, 10K_DOCUMENT_QUERY}",
            "Gatekeeper Principle: Gate before retrieval.",
            "No embeddings or vector search execute if unauthorized."
        ]
    )

    add_card(s7, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
        title="Enforcement Verification",
        body_bullets=[
            "Alice asks 10-K financial revenue:",
            "  -> Router identifies 10K_DOCUMENT_QUERY.",
            "  -> RBAC blocks request: ACCESS DENIED.",
            "Bob asks live internet search:",
            "  -> Router identifies INTERNET_QUERY.",
            "  -> RBAC blocks request: ACCESS DENIED.",
            "Carol asks OpenAI docs:",
            "  -> Unknown identity blocked before routing runs.",
            "Authorized requests proceed to grounded generation."
        ],
        border_color=COLOR_SUCCESS
    )

    # ==========================================
    # SLIDE 8: Deep Dive: Role-Aware Semantic Caching (Bonus)
    # ==========================================
    s8 = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(s8)
    add_header(s8, "Bonus Feature: Role-Aware Semantic Cache without Leaks")

    add_card(s8, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
        title="The Data Leak Vulnerability",
        body_bullets=[
            "The Problem with Naive Semantic Caching:",
            "  - Cache keyed solely on query text serves cached data across users.",
            "  - Bob (Finance) queries Uber revenue -> cached.",
            "  - Alice (Engineer) asks same question -> naive cache serves Bob's finance answer without checking RBAC!",
            "Architectural Solution: Partitioned Cache.",
            "  - Separate cache namespaces per role: self.partitions[role].",
            "  - Cosine distance threshold = 0.2 on 768-dim embeddings."
        ]
    )

    add_card(s8, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
        title="Strict Order of Operations & Tests",
        body_bullets=[
            "Mandatory Execution Pipeline:",
            "  Identity -> Route -> RBAC Gate -> Cache Check -> Pipeline",
            "Crucial Rule: Denials must NEVER be cached or checked.",
            "Passed all 6 assertions in run_self_check():",
            "  1. Bob first ask: MISS -> cached.",
            "  2. Bob repeat ask: HIT.",
            "  3. Alice asks finance: DENIED (Zero leak!).",
            "  4. Alice asks paraphrase: DENIED (No vector match).",
            "  5. Carol: DENIED. Alice shared doc: MISS -> HIT."
        ],
        border_color=COLOR_SUCCESS
    )

    # ==========================================
    # SLIDE 9: Verification Results & Validation Metrics
    # ==========================================
    s9 = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(s9)
    add_header(s9, "Validation: Complete Benchmark & Test Results")

    add_card(s9, Inches(0.8), Inches(1.8), Inches(11.7), Inches(5.0),
        title="End-to-End Execution Summary",
        body_bullets=[
            "Test 1 (Single Query): 'what was uber revenue in 2021?' -> 1 sub-query, fast-pathed, returned $17.455 billion [1].",
            "Test 2 (Compound 10-K): 'what was lyft revenue in 2021 and what was uber revenue in 2021' -> 2 sub-queries, both routed to 10-K filings, synthesized: Lyft ($4.095B [1]) & Uber ($17.455B [1]).",
            "Test 3 (Cross-Domain): 'what was uber's 2021 revenue and what are the newest LLMs?' -> Decomposed into 10K + SerpApi; synthesized response preserving exact financial citations and all 5 web sources.",
            "Test 4 (RBAC Security): Complete permission enforcement verified across Alice, Bob, and Carol.",
            "Test 5 (Semantic Cache): 100% pass on run_self_check() proving zero cross-role data leaks.",
            "Test 6 (Notebook Execution): 50 cells converted and executed top-to-bottom via nbconvert without errors."
        ],
        border_color=COLOR_SUCCESS
    )

    # ==========================================
    # SLIDE 10: Key Takeaways & Production Insights
    # ==========================================
    s10 = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_background(s10)
    add_header(s10, "Key Architectural Takeaways for Production Agentic AI")

    add_card(s10, Inches(0.8), Inches(1.8), Inches(3.7), Inches(5.0),
        title="1. Agency & Decoupling",
        body_bullets=[
            "Decouple decision-making from retrieval tools.",
            "Routers allow specialized stores to scale independently.",
            "Compound queries require decomposition rather than monolithic search."
        ]
    )

    add_card(s10, Inches(4.8), Inches(1.8), Inches(3.7), Inches(5.0),
        title="2. Security by Design",
        body_bullets=[
            "Access checks must sit before retrieval and before caching.",
            "Never assume an LLM prompt alone guarantees authorization.",
            "Cache partitioning prevents catastrophic cross-role data leakage."
        ],
        border_color=COLOR_PRIMARY
    )

    add_card(s10, Inches(8.8), Inches(1.8), Inches(3.7), Inches(5.0),
        title="3. Robust Grounding",
        body_bullets=[
            "Synthesize from indexed chunks and organic pages, not unverified snippets.",
            "Preserve end-to-end provenance with explicit citations.",
            "Traceability is what makes enterprise RAG trustworthy."
        ],
        border_color=COLOR_SUCCESS
    )

    output_path = os.path.join(os.getcwd(), "agentic_rag_presentation.pptx")
    prs.save(output_path)
    print(f"Presentation saved successfully to: {output_path}")

if __name__ == "__main__":
    create_deck()
