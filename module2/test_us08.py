import sys
import os
import asyncio
import nest_asyncio
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

nest_asyncio.apply()
load_dotenv()

from openai import OpenAI
from test_us03 import route_query, openaiclient
from test_us05 import routes, agentic_rag
from test_us07 import split_query

def synthesize_composite_answer(original_query: str, sub_results: list[dict]) -> str:
    """
    Synthesizes multiple sub-query results into a single coherent response,
    preserving all citations and sources from the individual answers.
    """
    context_sections = []
    for idx, item in enumerate(sub_results, 1):
        context_sections.append(
            f"### Sub-Question {idx}: {item['question']}\n"
            f"**Route Used**: `{item['action']}`\n"
            f"**Source Data / Answer**:\n{item['result']}\n"
        )
    combined_context = "\n".join(context_sections)

    synthesis_prompt = f"""
You are an expert AI synthesiser.
The user asked a multi-part or compound question: "{original_query}"

Below are answers retrieved from specialized sources for each sub-question:
{combined_context}

Please provide a unified, coherent response that completely and accurately addresses all parts of the user's question.

CRITICAL RULES:
1. Preserve all citations and references (such as [1], [2], or source URLs) from the provided sub-answers.
2. Format the response clearly with sections or bullet points for readability.
3. Do not drop facts, numbers, or details from any sub-question.
    """

    response = openaiclient.chat.completions.create(
        model="gpt-5.6-luna",
        messages=[{"role": "system", "content": synthesis_prompt}]
    )
    return response.choices[0].message.content

def agentic_rag_multi(user_query: str) -> str:
    """
    Split a compound query, run each sub-query through the agentic pipeline,
    and synthesise one final answer with citations preserved.
    """
    CYAN = "\033[96m"
    GREY = "\033[90m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

    print(f"\n{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{CYAN}👤 Multi-Agent Query:{RESET} {user_query}")
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════{RESET}\n")

    # Step 1: Decompose compound query into sub-questions
    questions = split_query(user_query)
    print(f"{GREY}📋 Decomposed into {len(questions)} sub-question(s):")
    for i, q in enumerate(questions, 1):
        print(f"   [{i}] {q}")
    print(f"{RESET}")

    # Fast path: Single question passes through agentic_rag without extra synthesis overhead
    if len(questions) <= 1:
        single_q = questions[0] if questions else user_query
        return agentic_rag(single_q)

    # Step 2: Route and execute each sub-query independently
    sub_results = []
    for idx, q in enumerate(questions, 1):
        print(f"{GREY}--- Executing Sub-Question [{idx}/{len(questions)}]: {q} ---{RESET}")
        decision = route_query(q)
        action = decision.get("action", "INTERNET_QUERY")
        reason = decision.get("reason", "")
        print(f"{GREY}   📍 Route: {action} | Reason: {reason}{RESET}")

        route_function = routes.get(action)
        if not route_function:
            result = f"Unsupported route: {action}"
        else:
            try:
                if action in ["OPENAI_QUERY", "10K_DOCUMENT_QUERY"]:
                    result = asyncio.run(route_function(q, action))
                else:
                    result = route_function(q, action)
            except Exception as e:
                result = f"Execution error on '{q}': {e}"

        sub_results.append({"question": q, "action": action, "result": result})

    # Step 3: Synthesize into one final coherent answer
    print(f"\n{BOLD}{CYAN}🔄 Synthesising unified response from all sub-answers...{RESET}\n")
    final_composite_answer = synthesize_composite_answer(user_query, sub_results)

    print(f"{BOLD}{CYAN}🤖 BOT FINAL COMPOSITE RESPONSE:{RESET}\n")
    print(final_composite_answer)
    print("\n")
    return final_composite_answer

if __name__ == "__main__":
    print("=" * 80)
    print("TEST CASE 1: Single query (No split, single route)")
    print("=" * 80)
    t1 = agentic_rag_multi("what was uber revenue in 2021?")
    assert t1 and len(t1) > 20, "Test 1 failed"

    print("=" * 80)
    print("TEST CASE 2: Compound query (Same domain - both 10-K)")
    print("=" * 80)
    t2 = agentic_rag_multi("what was lyft revenue in 2021 and what was uber revenue in 2021")
    assert ("uber" in t2.lower() or "lyft" in t2.lower()), "Test 2 failed"

    print("=" * 80)
    print("TEST CASE 3: Compound query (Cross-domain - 10-K + Internet)")
    print("=" * 80)
    t3 = agentic_rag_multi("what was uber's 2021 revenue and what are the newest LLMs?")
    assert ("uber" in t3.lower() and "revenue" in t3.lower()), "Test 3 failed"

    print("=" * 80)
    print("=== US-08 VERIFICATION SUCCESSFUL ===")
