import pino from 'pino';
import { chunksCollection, documentsCollection } from '../db.js';
import { getEmbeddings } from '../embeddings.js';
import { env } from '../env.js';
import type { ChunkDoc, Source, Locator } from '@lumina/contract';

const log = pino({ level: env.logLevel });

export interface SearchDocumentsOptions {
  spaceId: string;
  query: string;
  limit?: number;
  userId?: string;
}

export interface FusedChunkResult {
  chunk: ChunkDoc;
  score: number;
  title: string;
}

/**
 * Hybrid retrieval over space chunks:
 * Combines Atlas Vector Search ($vectorSearch on chunks_vector)
 * and Atlas Full-Text Search ($search on chunks_text)
 * fused using Reciprocal Rank Fusion (RRF: k = 60).
 */
export async function searchDocuments(options: SearchDocumentsOptions): Promise<FusedChunkResult[]> {
  const { spaceId, query, limit = 5 } = options;
  const chunksCol = await chunksCollection();
  const docsCol = await documentsCollection();

  // Text search does not need an embedding — start it while the query vector is computed.
  const textSearchPromise = chunksCol.aggregate<ChunkDoc>([
    {
      $search: {
        index: 'chunks_text',
        compound: {
          must: [{ text: { query, path: 'text' } }],
          filter: [{ equals: { path: 'spaceId', value: spaceId } }]
        }
      }
    },
    { $limit: 25 }
  ]).toArray();

  let queryEmbedding: number[] | undefined;
  try {
    [queryEmbedding] = await getEmbeddings([query]);
  } catch (err) {
    await Promise.allSettled([textSearchPromise]);
    throw err;
  }
  if (!queryEmbedding) {
    await Promise.allSettled([textSearchPromise]);
    throw new Error('Failed to generate embedding for query');
  }

  let vectorResults: ChunkDoc[] = [];
  let textResults: ChunkDoc[] = [];

  const [vecRes, txtRes] = await Promise.allSettled([
    chunksCol.aggregate<ChunkDoc>([
      {
        $vectorSearch: {
          index: 'chunks_vector',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: 40,
          limit: 25,
          filter: { spaceId: { $eq: spaceId } }
        }
      }
    ]).toArray(),
    textSearchPromise
  ]);

  if (vecRes.status === 'fulfilled') {
    vectorResults = vecRes.value;
  } else {
    log.warn({ err: vecRes.reason }, 'search_documents: vector search failed');
  }

  if (txtRes.status === 'fulfilled') {
    textResults = txtRes.value;
  } else {
    log.warn({ err: txtRes.reason }, 'search_documents: text search failed, proceeding with vector results');
  }

  // 4. Reciprocal Rank Fusion (RRF) with k = 60
  const RRF_K = 60;
  const scores = new Map<string, { chunk: ChunkDoc; score: number }>();

  vectorResults.forEach((chunk, index) => {
    const rank = index + 1;
    const rrf = 1 / (RRF_K + rank);
    const existing = scores.get(chunk._id);
    if (existing) {
      existing.score += rrf;
    } else {
      scores.set(chunk._id, { chunk, score: rrf });
    }
  });

  textResults.forEach((chunk, index) => {
    const rank = index + 1;
    const rrf = 1 / (RRF_K + rank);
    const existing = scores.get(chunk._id);
    if (existing) {
      existing.score += rrf;
    } else {
      scores.set(chunk._id, { chunk, score: rrf });
    }
  });

  // Sort by combined RRF score descending
  const sorted = Array.from(scores.values()).sort((a, b) => b.score - a.score);
  const topCandidates = sorted.slice(0, limit);

  if (topCandidates.length === 0) {
    return [];
  }

  // 5. Resolve document metadata (titles / filenames)
  const docIds = Array.from(new Set(topCandidates.map((c) => c.chunk.docId)));
  const docs = await docsCol.find({ _id: { $in: docIds as any } }).toArray();
  const docTitleMap = new Map<string, string>();
  for (const d of docs) {
    docTitleMap.set(d._id, d.title || (d as any).filename || 'Document');
  }

  return topCandidates.map((c) => ({
    chunk: c.chunk,
    score: c.score,
    title: docTitleMap.get(c.chunk.docId) || 'Document'
  }));
}

/**
 * Format fused document chunks into Contract Source items
 */
export function formatDocSources(fusedResults: FusedChunkResult[], startN = 1, subQuestion?: number): Source[] {
  const seenLocators = new Map<string, number>();
  return fusedResults.map((res, index) => {
    const docKey = `${res.chunk.docId}:${res.chunk.locator?.page ?? ''}:${res.chunk.locator?.heading ?? ''}`;
    const count = (seenLocators.get(docKey) ?? 0) + 1;
    seenLocators.set(docKey, count);

    const locator: Locator = {
      ...res.chunk.locator,
      ...(count > 1 ? { line: count } : {})
    };

    const item: Source = {
      n: startN + index,
      kind: 'doc',
      title: res.title,
      snippet: res.chunk.text,
      docId: res.chunk.docId as any,
      locator
    };
    if (subQuestion !== undefined) {
      item.subQuestion = subQuestion;
    }
    return item;
  });
}
