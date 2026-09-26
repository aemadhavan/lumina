import sys
import os
import requests
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()
serp_api_key = os.getenv('SERP_API_KEY') or os.getenv('SERPAPI_API_KEY') or os.getenv('SERPAPI_KEY')
assert serp_api_key, 'SerpApi key is required'

def get_internet_content(user_query: str, action: str) -> str:
    """
    Fetches a response from the internet using SerpApi based on the user's query.
    """
    print("Getting your response from the internet 🌐 ...")
    params = {
        "q": user_query,
        "api_key": serp_api_key,
        "engine": "google",
        "num": 5,
    }
    try:
        response = requests.get("https://serpapi.com/search.json", params=params)
        response.raise_for_status()
        data = response.json()
        parts = []

        answer_box = data.get("answer_box", {})
        if answer_box.get("answer"):
            parts.append(f"[Direct Answer] {answer_box.get('answer')}")
        elif answer_box.get("snippet"):
            parts.append(f"[Direct Answer] {answer_box.get('snippet')}")

        for i, result in enumerate(data.get("organic_results", [])[:5], start=1):
            title = result.get("title", "")
            snippet = result.get("snippet", "")
            link = result.get("link", "")
            if snippet:
                parts.append(f"[{i}] {title}\n    {snippet}\n    Source: {link}")

        if not parts:
            return "No results found."
        return "\n\n".join(parts)
    except requests.exceptions.HTTPError as http_err:
        return f"HTTP error occurred: {http_err}"
    except requests.exceptions.RequestException as req_err:
        return f"Request error occurred: {req_err}"
    except Exception as err:
        return f"An unexpected error occurred: {err}"

if __name__ == "__main__":
    print("--- Testing get_internet_content ---")
    query = "Tell me about best travel destinations in 2026?"
    result = get_internet_content(query, "INTERNET_QUERY")
    print("Result Snippet:\n")
    print(result[:600])
    print("\n------------------------------------")
    assert "Source:" in result or "[Direct Answer]" in result, "Expected structured result with source links or direct answer"
    print("=== US-02 VERIFICATION SUCCESSFUL ===")
