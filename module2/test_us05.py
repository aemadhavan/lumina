import sys
import os
import asyncio
import nest_asyncio
from dotenv import load_dotenv

# Reconfigure stdout/stderr for UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

nest_asyncio.apply()
load_dotenv()

# Import verified components
from test_us02 import get_internet_content
from test_us03 import route_query
from test_us04 import retrieve_and_response

routes = {
    "OPENAI_QUERY": retrieve_and_response,
    "10K_DOCUMENT_QUERY": retrieve_and_response,
    "INTERNET_QUERY": get_internet_content,
}

def agentic_rag(user_query: str) -> str:
    """
    Main orchestrator that runs the full Agentic RAG system for single queries.
    """
    CYAN = "\033[96m"
    GREY = "\033[90m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

    try:
        print(f"{BOLD}{CYAN}👤 User Query:{RESET} {user_query}\n")

        # Step 1: Route query
        try:
            response = route_query(user_query)
        except Exception as route_err:
            print(f"{BOLD}{CYAN}🤖 BOT RESPONSE:{RESET}\nRouting error: {route_err}\n")
            return f"Routing error: {route_err}"

        action = response.get("action")
        reason = response.get("reason")

        print(f"{GREY}📍 Selected Route: {action}")
        print(f"📝 Reason: {reason}")
        print(f"⚙️ Processing query...{RESET}\n")

        # Step 2: Call matching handler
        route_function = routes.get(action)
        if not route_function:
            result = f"Unsupported action: {action}"
        else:
            if action in ["OPENAI_QUERY", "10K_DOCUMENT_QUERY"]:
                result = asyncio.run(route_function(user_query, action))
            else:
                result = route_function(user_query, action)

        print(f"{BOLD}{CYAN}🤖 BOT RESPONSE:{RESET}\n")
        print(f"{result}\n")
        return result

    except Exception as err:
        print(f"{BOLD}{CYAN}🤖 BOT RESPONSE:{RESET}\nUnexpected error occurred: {err}\n")
        return f"Unexpected error occurred: {err}"

if __name__ == "__main__":
    test_queries = [
        "what was uber revenue in 2021?",
        "List me down new LLMs in 2025",
        "best ways to build Agents"
    ]

    for q in test_queries:
        print("=" * 70)
        res = agentic_rag(q)
        assert res and len(res) > 20, f"Expected non-empty response for: {q}"

    print("=" * 70)
    print("=== US-05 VERIFICATION SUCCESSFUL ===")
