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

from test_us03 import route_query
from test_us05 import routes

USERS = {
    "alice": "engineer",
    "bob":   "finance_analyst",
}

ROLE_PERMISSIONS = {
    "engineer":        {"OPENAI_QUERY", "INTERNET_QUERY"},
    "finance_analyst": {"OPENAI_QUERY", "10K_DOCUMENT_QUERY"},
}

SOURCE_LABELS = {
    "OPENAI_QUERY":       "OpenAI documentation",
    "10K_DOCUMENT_QUERY": "10-K financial filings",
    "INTERNET_QUERY":     "live internet search",
}

def has_access(user_id: str, action: str) -> bool:
    role = USERS.get(user_id)
    return role is not None and action in ROLE_PERMISSIONS.get(role, set())

def allowed_sources(user_id: str) -> set:
    return ROLE_PERMISSIONS.get(USERS.get(user_id), set())

def secure_agentic_rag(user_id: str, user_query: str) -> str:
    CYAN, GREY, RED, GREEN, BOLD, RESET = (
        "\033[96m", "\033[90m", "\033[91m", "\033[92m", "\033[1m", "\033[0m"
    )

    role = USERS.get(user_id)
    print(f"{BOLD}{CYAN}👤 User:{RESET} {user_id}  (role: {role or 'UNKNOWN'})")
    print(f"{BOLD}{CYAN}❓ Query:{RESET} {user_query}\n")

    # Step 1: Unknown user denied before anything else runs
    if role is None:
        print(f"{RED}🚫 ACCESS DENIED{RESET} — unknown user '{user_id}'.\n")
        return f"🚫 Access denied: unknown user '{user_id}'."

    # Step 2: Route query
    try:
        decision = route_query(user_query)
    except Exception as route_err:
        return f"Routing error: {route_err}"

    action = decision.get("action")
    reason = decision.get("reason")
    print(f"{GREY}📍 Selected Route: {action}")
    print(f"📝 Reason: {reason}{RESET}\n")

    # Step 3: Check permission gate before retrieval
    if not has_access(user_id, action):
        source = SOURCE_LABELS.get(action, action)
        print(f"{RED}🚫 ACCESS DENIED{RESET} — role '{role}' may not query {source}.\n")
        return f"🚫 Access denied: your role ('{role}') does not have permission to query {source}."

    print(f"{GREEN}✅ Access granted{RESET} — processing...\n")

    # Step 4: Run authorized route
    try:
        route_function = routes.get(action)
        if not route_function:
            return f"Unsupported action: {action}"
        if action in ["OPENAI_QUERY", "10K_DOCUMENT_QUERY"]:
            result = asyncio.run(route_function(user_query, action))
        else:
            result = route_function(user_query, action)
    except Exception as exec_err:
        result = f"Execution error: {exec_err}"

    print(f"{BOLD}{CYAN}🤖 BOT RESPONSE:{RESET}\n")
    print(f"{result}\n")
    return result

if __name__ == "__main__":
    print("=" * 70)
    print("1) alice (engineer) asks about 10-K -> MUST BE DENIED")
    r1 = secure_agentic_rag("alice", "what was uber revenue in 2021?")
    assert "Access denied" in r1, f"Expected denial for alice, got: {r1}"

    print("=" * 70)
    print("2) bob (finance_analyst) asks about 10-K -> MUST BE ALLOWED")
    r2 = secure_agentic_rag("bob", "what was uber revenue in 2021?")
    assert "Access denied" not in r2 and len(r2) > 20, f"Expected allowed for bob, got: {r2}"

    print("=" * 70)
    print("3) bob (finance_analyst) asks for live web -> MUST BE DENIED")
    r3 = secure_agentic_rag("bob", "List me down new LLMs in 2025")
    assert "Access denied" in r3, f"Expected denial for bob on web search, got: {r3}"

    print("=" * 70)
    print("4) carol (unknown user) -> MUST BE REJECTED IMMEDIATELY")
    r4 = secure_agentic_rag("carol", "what is an AI agent?")
    assert "unknown user 'carol'" in r4, f"Expected unknown user denial, got: {r4}"

    print("=" * 70)
    print("5) alice (engineer) asks about OpenAI docs -> MUST BE ALLOWED")
    r5 = secure_agentic_rag("alice", "best ways to build Agents")
    assert "Access denied" not in r5 and len(r5) > 20, f"Expected allowed for alice, got: {r5}"

    print("=" * 70)
    print("=== US-06 VERIFICATION SUCCESSFUL ===")
