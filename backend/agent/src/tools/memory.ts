import { randomUUID } from 'node:crypto';
import type { MemoryDoc } from '@lumina/contract';
import { memoriesCollection } from '../db.js';
import { getEmbedding } from '../embeddings.js';

export interface SaveMemoryInput {
  userId: string;
  text: string;
  sourceThread?: string;
}

export interface RecallMemoryInput {
  userId: string;
  query: string;
  limit?: number;
}

export interface RecalledMemory {
  memoryId: string;
  text: string;
  score?: number;
  createdAt?: string;
}

/**
 * Save a long-term memory fact or preference for a user.
 */
export async function saveMemory(input: SaveMemoryInput): Promise<MemoryDoc> {
  const cleanText = input.text.trim();
  if (!cleanText) {
    throw new Error('Memory text cannot be empty');
  }

  const embedding = await getEmbedding(cleanText);
  const memoryId = `mem_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  const doc: MemoryDoc = {
    _id: memoryId,
    userId: input.userId,
    text: cleanText,
    embedding,
    sourceThread: input.sourceThread,
    createdAt: now
  };

  const col = await memoriesCollection();
  await col.insertOne(doc);

  return doc;
}

/**
 * Recall semantic memories relevant to a query using Atlas Vector Search.
 */
export async function recallMemory(input: RecallMemoryInput): Promise<RecalledMemory[]> {
  const cleanQuery = input.query.trim();
  if (!cleanQuery) return [];

  const queryEmbedding = await getEmbedding(cleanQuery);
  const col = await memoriesCollection();
  const limit = input.limit ?? 3;

  try {
    const pipeline = [
      {
        $vectorSearch: {
          index: 'memories_vector',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: 30,
          limit,
          filter: {
            userId: { $eq: input.userId }
          }
        }
      },
      {
        $project: {
          _id: 1,
          text: 1,
          createdAt: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ];

    const results = await col.aggregate(pipeline).toArray();

    if (results.length > 0) {
      return results.map((r) => ({
        memoryId: String(r._id),
        text: String(r.text),
        score: typeof r.score === 'number' ? r.score : undefined,
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : r.createdAt?.toISOString()
      }));
    }

    // If vector index is still syncing freshly inserted memories, fallback to recent user memories
    const recent = await col
      .find({ userId: input.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return recent.map((r) => ({
      memoryId: String(r._id),
      text: String(r.text),
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : r.createdAt?.toISOString()
    }));
  } catch (err) {
    console.warn('Atlas vector search on memories failed, falling back to recent scan:', err);
    // Fallback if vector index is temporarily syncing: return most recent memories for user
    const recent = await col
      .find({ userId: input.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return recent.map((r) => ({
      memoryId: String(r._id),
      text: String(r.text),
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : r.createdAt?.toISOString()
    }));
  }
}
