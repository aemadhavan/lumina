import sys
import os
import re
import json
from dotenv import load_dotenv
from openai import OpenAI, OpenAIError

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()
openaiclient = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def route_query(user_query: str) -> dict:
    router_system_prompt = f"""
    As a professional query router, your objective is to correctly classify user input into one of three categories based on the source most relevant for answering the query:
    1. "OPENAI_QUERY": If the user's query appears to be answerable using information from OpenAI's official documentation about Agents, tools, models, APIs, or services (e.g., guardrails, agents, what is an agent, embeddings, moderation API, usage guidelines).
    2. "10K_DOCUMENT_QUERY": If the user's query pertains to a collection of documents from the 10k annual reports, datasets, or other structured documents, typically for research, analysis, or financial content.
    3. "INTERNET_QUERY": If the query is neither related to OpenAI nor the 10k documents specifically, or if the information might require a broader search (e.g., news, trends, tools outside these platforms), route it here.

    Your decision should be made by assessing the domain of the query.

    Always respond in this valid JSON format:
    {{
        "action": "OPENAI_QUERY" or "10K_DOCUMENT_QUERY" or "INTERNET_QUERY",
        "reason": "brief justification",
        "answer": "AT MAX 5 words answer. Leave empty if INTERNET_QUERY"
    }}

    EXAMPLES:

    - User: "How to fine-tune GPT-3?"
    Response:
    {{
        "action": "OPENAI_QUERY",
        "reason": "Fine-tuning is OpenAI-specific",
        "answer": "Use fine-tuning API"
    }}

    - User: "Where can I find the latest financial reports for the last 10 years?"
    Response:
    {{
        "action": "10K_DOCUMENT_QUERY",
        "reason": "Query related to annual reports",
        "answer": "Access through document database"
    }}

    - User: "Top leadership styles in 2024"
    Response:
    {{
        "action": "INTERNET_QUERY",
        "reason": "Needs current leadership trends",
        "answer": ""
    }}

    - User: "What's the difference between ChatGPT and Claude?"
    Response:
    {{
        "action": "INTERNET_QUERY",
        "reason": "Cross-comparison of different providers",
        "answer": ""
    }}

    Strictly follow this format for every query, and never deviate.
    User: {user_query}
    """

    try:
        response = openaiclient.chat.completions.create(
            model="gpt-5.6-luna",
            messages=[{"role": "system", "content": router_system_prompt}]
        )
        task_response = response.choices[0].message.content
        json_match = re.search(r"\{.*\}", task_response, re.DOTALL)
        if not json_match:
            raise json.JSONDecodeError("No JSON structure matched", task_response, 0)
        json_text = json_match.group()
        parsed_response = json.loads(json_text)
        return parsed_response

    except OpenAIError as api_err:
        return {
            "action": "INTERNET_QUERY",
            "reason": f"OpenAI API error: {api_err}",
            "answer": ""
        }
    except json.JSONDecodeError as json_err:
        return {
            "action": "INTERNET_QUERY",
            "reason": f"JSON parsing error: {json_err}",
            "answer": ""
        }
    except Exception as err:
        return {
            "action": "INTERNET_QUERY",
            "reason": f"Unexpected error: {err}",
            "answer": ""
        }

if __name__ == "__main__":
    print("--- 1. Testing Financial Query ---")
    r1 = route_query("what is the revenue of uber in 2021?")
    print("  Query: 'what is the revenue of uber in 2021?' ->", r1)
    assert r1.get("action") == "10K_DOCUMENT_QUERY", f"Expected 10K_DOCUMENT_QUERY, got {r1.get('action')}"

    print("\n--- 2. Testing OpenAI Documentation Query ---")
    r2 = route_query("what is an AI Agent?")
    print("  Query: 'what is an AI Agent?' ->", r2)
    assert r2.get("action") == "OPENAI_QUERY", f"Expected OPENAI_QUERY, got {r2.get('action')}"

    print("\n--- 3. Testing Internet / Comparative Query ---")
    r3 = route_query("Tell me about best travel destinations in 2026?")
    print("  Query: 'Tell me about best travel destinations in 2026?' ->", r3)
    assert r3.get("action") == "INTERNET_QUERY", f"Expected INTERNET_QUERY, got {r3.get('action')}"

    print("\n=== US-03 VERIFICATION SUCCESSFUL ===")
