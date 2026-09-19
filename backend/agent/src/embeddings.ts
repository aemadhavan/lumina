import { env, secrets } from './env.js';
import { EMBEDDING_DIMS } from '@lumina/contract';

export async function getEmbedding(text: string): Promise<number[]> {
  const [emb] = await getEmbeddings([text]);
  if (!emb) throw new Error('Failed to generate embedding');
  return emb;
}

const embeddingCache = new Map<string, { value: number[]; expiresAt: number }>();
const EMBED_CACHE_TTL_MS = 30 * 60 * 1000;

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  if (!secrets.openai) {
    throw new Error('OPENAI_API_KEY is not set — required for vector embeddings');
  }

  const cleanTexts = texts.map((t) => t.replace(/\r\n/g, '\n').trim() || ' ');
  const now = Date.now();
  const cached = cleanTexts.map((t) => {
    const hit = embeddingCache.get(t);
    return hit && hit.expiresAt > now ? hit.value : null;
  });
  if (cached.every((v) => v)) return cached as number[][];

  const missing = cleanTexts.filter((_, i) => !cached[i]);

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secrets.openai}`
    },
    body: JSON.stringify({
      model: env.embeddingModel,
      input: missing
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
  const fresh = sorted.map((d) => d.embedding);

  for (const emb of fresh) {
    if (emb.length !== EMBEDDING_DIMS) {
      throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIMS}, got ${emb.length}`);
    }
  }

  let fi = 0;
  const embeddings = cleanTexts.map((text, i) => {
    if (cached[i]) return cached[i]!;
    const emb = fresh[fi++]!;
    embeddingCache.set(text, { value: emb, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
    return emb;
  });

  return embeddings;
}
