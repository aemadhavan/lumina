import { MongoClient, GridFSBucket, type Db, type Collection } from 'mongodb';
import {
  COLLECTIONS,
  GRIDFS_BUCKETS,
  type ThreadDoc,
  type MessageDoc,
  type MemoryDoc,
  type SpaceDoc,
  type DocumentDoc,
  type ChunkDoc,
  type SearchCacheDoc,
  type JobDoc,
  type RequestDoc,
  type RunDoc
} from '@lumina/contract';
import { env } from './env.js';

let client: MongoClient | null = null;

/** One client per process. The driver pools connections; do not open one per request. */
export async function getClient(): Promise<MongoClient> {
  if (!env.mongoUri) throw new Error('MONGODB_URI is not set — copy .env.example to .env');
  if (!client) {
    client = new MongoClient(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
  }
  return client;
}

export async function db(): Promise<Db> {
  const c = await getClient();
  return c.db(env.mongoDb);
}

let cachedBucket: GridFSBucket | null = null;

export async function bucket(): Promise<GridFSBucket> {
  if (!cachedBucket) {
    const database = await db();
    cachedBucket = new GridFSBucket(database, { bucketName: GRIDFS_BUCKETS.uploads });
  }
  return cachedBucket;
}

export async function pingDb(): Promise<'ok' | 'down'> {
  try {
    await (await db()).command({ ping: 1 });
    return 'ok';
  } catch {
    return 'down';
  }
}

export async function closeDb(): Promise<void> {
  cachedBucket = null;
  if (client) {
    await client.close();
    client = null;
  }
}

// Typed collections
export async function threadsCollection(): Promise<Collection<ThreadDoc>> {
  return (await db()).collection<ThreadDoc>(COLLECTIONS.threads);
}

export async function messagesCollection(): Promise<Collection<MessageDoc>> {
  return (await db()).collection<MessageDoc>(COLLECTIONS.messages);
}

export async function memoriesCollection(): Promise<Collection<MemoryDoc>> {
  return (await db()).collection<MemoryDoc>(COLLECTIONS.memories);
}

export async function spacesCollection(): Promise<Collection<SpaceDoc>> {
  return (await db()).collection<SpaceDoc>(COLLECTIONS.spaces);
}

export async function documentsCollection(): Promise<Collection<DocumentDoc>> {
  return (await db()).collection<DocumentDoc>(COLLECTIONS.documents);
}

export async function chunksCollection(): Promise<Collection<ChunkDoc>> {
  return (await db()).collection<ChunkDoc>(COLLECTIONS.chunks);
}

export async function searchCacheCollection(): Promise<Collection<SearchCacheDoc>> {
  return (await db()).collection<SearchCacheDoc>(COLLECTIONS.searchCache);
}

export async function jobsCollection(): Promise<Collection<JobDoc>> {
  return (await db()).collection<JobDoc>(COLLECTIONS.jobs);
}

export async function requestsCollection(): Promise<Collection<RequestDoc>> {
  return (await db()).collection<RequestDoc>(COLLECTIONS.requests);
}

export async function runsCollection(): Promise<Collection<RunDoc>> {
  return (await db()).collection<RunDoc>(COLLECTIONS.runs);
}
