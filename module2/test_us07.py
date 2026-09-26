import sys
import os
import re
import json
from dotenv import load_dotenv
from openai import OpenAI

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()
openaiclient = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def sub_queries(user_query: str) -> str:
    sub_queries_prompt = f"""
  You are a query router. If the input contains multiple distinct questions, break it into sub-questions. Otherwise, keep it as one. Return a JSON object like:

  {{
      "subQuestions": ["..."]
  }}

  Query: "{user_query}"
  Output:
    """
    response = openaiclient.chat.completions.create(
        model="gpt-5.6-luna",
        messages=[{"role": "system", "content": sub_queries_prompt}]
    )
    return response.choices[0].message.content

def parse_sub_queries_defensive(raw_output: str, fallback_query: str) -> list[str]:
    """
    Defensively parses model string output to extract list of subQuestions.
    Handles markdown blocks (```json ... ```), extra prose, and malformed strings.
    Falls back gracefully to [fallback_query].
    """
    if not raw_output or not isinstance(raw_output, str):
        return [fallback_query]

    # Clean markdown code fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_output.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())

    try:
        json_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            sub_q = parsed.get("subQuestions", [])
            if isinstance(sub_q, list) and len(sub_q) > 0:
                # Filter out empty or whitespace-only items
                valid_items = [str(q).strip() for q in sub_q if str(q).strip()]
                if valid_items:
                    return valid_items
    except Exception:
        pass

    return [fallback_query]

def split_query(user_query: str) -> list[str]:
    raw = sub_queries(user_query)
    return parse_sub_queries_defensive(raw, user_query)

if __name__ == "__main__":
    print("--- 1. Testing Single Query (No Split Expected) ---")
    q1 = "what was uber revenue in 2021?"
    res1 = split_query(q1)
    print(f"  Input: '{q1}'\n  Sub-queries: {res1}")
    assert len(res1) == 1, f"Expected 1 sub-query, got {len(res1)}"

    print("\n--- 2. Testing Compound Query (Same Domain) ---")
    q2 = "what was lyft revenue in 2021 and what was uber revenue in 2021"
    res2 = split_query(q2)
    print(f"  Input: '{q2}'\n  Sub-queries: {res2}")
    assert len(res2) == 2, f"Expected 2 sub-queries, got {len(res2)}"

    print("\n--- 3. Testing Cross-Domain Compound Query ---")
    q3 = "what was uber's 2021 revenue and what are the newest LLMs?"
    res3 = split_query(q3)
    print(f"  Input: '{q3}'\n  Sub-queries: {res3}")
    assert len(res3) == 2, f"Expected 2 sub-queries, got {len(res3)}"

    print("\n--- 4. Testing Defensive Parsing with Malformed Input ---")
    malformed1 = "Here is your JSON: ```json\n{\"subQuestions\": [\"Part A\", \"Part B\"]}\n``` Hope that helps!"
    res_mal1 = parse_sub_queries_defensive(malformed1, "fallback")
    print("  Markdown wrapped test:", res_mal1)
    assert res_mal1 == ["Part A", "Part B"]

    malformed2 = "I could not parse this question properly."
    res_mal2 = parse_sub_queries_defensive(malformed2, "original fallback")
    print("  Broken text test:", res_mal2)
    assert res_mal2 == ["original fallback"]

    print("\n=== US-07 VERIFICATION SUCCESSFUL ===")
