import sys
import os
import asyncio
import numpy as np
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()

from test_us03 import route_query
from test_us04 import get_text_embeddings
from test_us05 import routes
from test_us06 import USERS, ROLE_PERMISSIONS, has_access, SOURCE_LABELS

class RoleAwareSemanticCache:
    """
    A semantic cache that cannot serve an answer across a permission boundary.

    Design choice: Partitioned cache.
    Justification: By isolating cache indices per role (self.caches[role]), cross-role
    information leakage is architecturally impossible at the index level. Even if a query
    is semantically identical, one role's namespace can never be queried by another.
    """
    def __init__(self, threshold: float = 0.2):
        self.threshold = threshold
        # Role -> list of dicts: {"question": str, "answer": str, "embedding": np.ndarray}
        self.partitions: dict[str, list[dict]] = {}

    def _cosine_distance(self, v1: np.ndarray, v2: np.ndarray) -> float:
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 == 0 or norm2 == 0:
            return 1.0
        similarity = np.dot(v1, v2) / (norm1 * norm2)
        return float(1.0 - similarity)

    def check(self, user_id: str, question: str):
        """
        Return (hit: bool, answer: str | None, embedding, distance: float | None).
        """
        role = USERS.get(user_id)
        if not role or role not in self.partitions:
            emb = get_text_embeddings(question)
            return False, None, emb, None

        emb = get_text_embeddings(question)
        best_dist = float("inf")
        best_answer = None

        for item in self.partitions[role]:
            dist = self._cosine_distance(emb, item["embedding"])
            if dist < best_dist:
                best_dist = dist
                best_answer = item["answer"]

        if best_dist <= self.threshold:
            return True, best_answer, emb, best_dist

        return False, None, emb, best_dist

    def add(self, user_id: str, question: str, answer: str, embedding: np.ndarray):
        """Store an answer scoped to this user's permissions."""
        role = USERS.get(user_id)
        if not role:
            return
        if role not in self.partitions:
            self.partitions[role] = []

        self.partitions[role].append({
            "question": question,
            "answer": answer,
            "embedding": embedding
        })

def secure_agentic_rag_cached(user_id: str, user_query: str, cache: RoleAwareSemanticCache) -> dict:
    """
    RBAC-gated agentic RAG with a role-aware semantic cache.

    Strict Order of Operations:
        1. Identify user      -> unknown users are rejected immediately (DENIED)
        2. Route the query    -> which source does this need?
        3. RBAC check         -> role allowed? If not -> DENIED (never look up cache)
        4. Cache lookup       -> HIT -> return stored answer
                              -> MISS -> run pipeline, store in cache, return
    """
    role = USERS.get(user_id)

    # 1. Identity Check
    if role is None:
        return {
            "answer": f"🚫 Access denied: unknown user '{user_id}'.",
            "status": "DENIED",
            "role": None
        }

    # 2. Route the query
    decision = route_query(user_query)
    action = decision.get("action", "INTERNET_QUERY")

    # 3. RBAC Permission Check (Crucial: MUST happen before cache lookup)
    if not has_access(user_id, action):
        source = SOURCE_LABELS.get(action, action)
        return {
            "answer": f"🚫 Access denied: your role ('{role}') does not have permission to query {source}.",
            "status": "DENIED",
            "role": role
        }

    # 4. Cache Lookup
    hit, cached_answer, embedding, dist = cache.check(user_id, user_query)
    if hit:
        return {
            "answer": cached_answer,
            "status": "HIT",
            "role": role
        }

    # 5. Cache Miss -> Execute pipeline
    route_function = routes.get(action)
    if not route_function:
        result = f"Unsupported action: {action}"
    else:
        if action in ["OPENAI_QUERY", "10K_DOCUMENT_QUERY"]:
            result = asyncio.run(route_function(user_query, action))
        else:
            result = route_function(user_query, action)

    # Store in role-partitioned cache
    cache.add(user_id, user_query, result, embedding)

    return {
        "answer": result,
        "status": "MISS",
        "role": role
    }

def run_self_check():
    cache = RoleAwareSemanticCache()
    q_fin = "what was uber revenue in 2021?"
    q_doc = "how do I build an agent with the OpenAI Agents SDK?"

    print("--- 1. bob asks financials (first ask -> MISS) ---")
    r = secure_agentic_rag_cached("bob", q_fin, cache)
    assert r["status"] == "MISS", f"expected MISS, got {r['status']}"
    print("  [PASS] bob first ask is MISS")

    print("--- 2. bob asks again -> HIT ---")
    r = secure_agentic_rag_cached("bob", q_fin, cache)
    assert r["status"] == "HIT", f"expected HIT, got {r['status']}"
    print("  [PASS] bob second ask is HIT")

    print("--- 3. LEAK TEST: alice asks financials -> MUST BE DENIED ---")
    r = secure_agentic_rag_cached("alice", q_fin, cache)
    assert r["status"] == "DENIED", f"LEAK: alice got {r['status']} on finance data"
    print("  [PASS] alice denied on finance query")

    print("--- 4. Paraphrase test: alice asks paraphrase -> MUST BE DENIED ---")
    r = secure_agentic_rag_cached("alice", "how much revenue did Uber make in 2021?", cache)
    assert r["status"] == "DENIED", f"LEAK: alice got {r['status']} via paraphrase"
    print("  [PASS] alice denied on paraphrase")

    print("--- 5. Unknown user test: carol asks doc -> MUST BE DENIED ---")
    r = secure_agentic_rag_cached("carol", q_doc, cache)
    assert r["status"] == "DENIED", f"expected DENIED for unknown user, got {r['status']}"
    print("  [PASS] unknown user carol denied")

    print("--- 6. Shared source caching for alice ---")
    r_miss = secure_agentic_rag_cached("alice", q_doc, cache)
    assert r_miss["status"] == "MISS", f"expected MISS, got {r_miss['status']}"
    r_hit = secure_agentic_rag_cached("alice", q_doc, cache)
    assert r_hit["status"] == "HIT", f"expected HIT, got {r_hit['status']}"
    print("  [PASS] alice shared source misses then hits")

    print("\n✅ All checks passed — cache is fast and does not leak across roles.")

if __name__ == "__main__":
    run_self_check()
    print("=== US-10 VERIFICATION SUCCESSFUL ===")
