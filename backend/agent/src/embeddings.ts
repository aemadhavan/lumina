import { env, secrets } from './env.js';
import { EMBEDDING_DIMS } from '@lumina/contract';

export async function getEmbedding(text: string): Promise<number[]> {
  const [emb] = await getEmbeddings([text]);
  if (!emb) throw new Error('Failed to generate embedding');
  return emb;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  if (!secrets.openai) {
    throw new Error('OPENAI_API_KEY is not set — required for vector embeddings');
  }

  const cleanTexts = texts.map((t) => t.replace(/\r\n/g, '\n').trim() || ' ');

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secrets.openai}`
    },
    body: JSON.stringify({
      model: env.embeddingModel,
      input: cleanTexts
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI embeddings upstream failure (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
  // Ensure order is preserved by index
  const sorted = data.data.sort((a, b) => a.index - b.index);
  const embeddings = sorted.map((d) => d.embedding);

  for (const emb of embeddings) {
    if (emb.length !== EMBEDDING_DIMS) {
      throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIMS}, got ${emb.length}`);
    }
  }

  return embeddings;
}
