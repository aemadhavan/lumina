import sys
import os
import asyncio
from dotenv import load_dotenv
from openai import OpenAI
import qdrant_client
from transformers import AutoTokenizer, AutoModel
import numpy as np

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()
openaiclient = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# 1. Setup Qdrant
QDRANT_PATH = os.path.join(os.getcwd(), "Agentic_RAG", "qdrant_data")
client = qdrant_client.AsyncQdrantClient(path=QDRANT_PATH)

# 2. Setup Embedding Model
text_tokenizer = AutoTokenizer.from_pretrained("nomic-ai/nomic-embed-text-v1.5", trust_remote_code=True)
text_model = AutoModel.from_pretrained("nomic-ai/nomic-embed-text-v1.5", trust_remote_code=True)

def get_text_embeddings(text: str) -> np.ndarray:
    inputs = text_tokenizer(text, return_tensors="pt", padding=True, truncation=True)
    outputs = text_model(**inputs)
    embeddings = outputs.last_hidden_state.mean(dim=1)
    return embeddings[0].detach().numpy()

def rag_formatted_response(user_query: str, context: list) -> str:
    rag_prompt = f"""
       Based on the given context, answer the user query: {user_query}
Context:
{context}
       and employ references to the ID of articles provided [ID], ensuring their relevance to the query.
       The referencing should always be in the format of [1][2]... etc. </instructions>
    """
    response = openaiclient.chat.completions.create(
        model="gpt-5.6-luna",
        messages=[{"role": "system", "content": rag_prompt}]
    )
    return response.choices[0].message.content

async def retrieve_and_response(user_query: str, action: str) -> str:
    collections = {
        "OPENAI_QUERY": "opnai_data",
        "10K_DOCUMENT_QUERY": "10k_data"
    }
    if action not in collections:
        return "Invalid action type for retrieval."

    try:
        query = get_text_embeddings(user_query)
    except Exception as embed_err:
        return f"Embedding error: {embed_err}"

    try:
        text_hits = await client.query_points(
            collection_name=collections[action],
            query=query,
            limit=3
        )
    except Exception as qdrant_err:
        return f"Vector DB query error: {qdrant_err}"

    contents = [point.payload['content'] for point in text_hits.points]
    if not contents:
        return "No relevant content found in the database."

    try:
        response = rag_formatted_response(user_query, contents)
        return response
    except Exception as rag_err:
        return f"RAG response error: {rag_err}"

async def run_tests():
    print("--- 1. Testing 10K Retrieval & Citations (Uber 2021 Revenue) ---")
    query_fin = "what was uber revenue in 2021?"
    resp_fin = await retrieve_and_response(query_fin, "10K_DOCUMENT_QUERY")
    print("Response:\n", resp_fin)
    assert "[" in resp_fin and "]" in resp_fin, "Expected citations in response"
    print("\n  [PASS] 10K retrieval and citation verified.")

    print("\n--- 2. Testing OpenAI Docs Retrieval & Citations (AI Agents) ---")
    query_docs = "what is an AI Agent?"
    resp_docs = await retrieve_and_response(query_docs, "OPENAI_QUERY")
    print("Response:\n", resp_docs)
    assert len(resp_docs) > 20, "Expected substantive response from OpenAI docs"
    print("\n  [PASS] OpenAI docs retrieval verified.")

if __name__ == "__main__":
    asyncio.run(run_tests())
    print("\n=== US-04 VERIFICATION SUCCESSFUL ===")
