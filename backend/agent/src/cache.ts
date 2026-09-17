import { searchCacheCollection } from './db.js';
import { env } from './env.js';
import {
  normalizeQuery,
  searchCacheKey,
  executeWebSearch,
  type SearchResultItem,
  type WebSearchInput,
  type WebSearchResult
} from './tools/web_search.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache = new Map<K, CacheEntry<V>>();

  constructor(capacity = 500) {
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh recency
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// In-process Tier 1 LRU cache for search results
export const inMemorySearchCache = new LRUCache<string, SearchResultItem[]>(1000);

export interface CachedSearchResult extends WebSearchResult {
  cached: boolean;
  tier?: 'lru' | 'mongo';
}

/**
 * Two-tier search cache retrieval:
 * Tier 1: In-process LRU cache
 * Tier 2: MongoDB searchCache collection with TTL index
 */
export async function getCachedSearch(
  normalizedQuery: string,
  provider: 'tavily' | 'serpapi'
): Promise<{ hit: boolean; tier?: 'lru' | 'mongo'; results?: SearchResultItem[] }> {
  const key = searchCacheKey(normalizedQuery, provider);

  // Tier 1: In-process LRU check
  const lruHit = inMemorySearchCache.get(key);
  if (lruHit) {
    return { hit: true, tier: 'lru', results: lruHit };
  }

  // Tier 2: MongoDB TTL collection check
  try {
    const col = await searchCacheCollection();
    const doc = await col.findOne({ _id: key });
    if (doc) {
      const expiresAt = new Date(doc.expiresAt).getTime();
      if (expiresAt > Date.now()) {
        const results = (doc.results as unknown as SearchResultItem[]) ?? [];
        // Populate Tier 1 with remaining TTL
        const remainingTtl = expiresAt - Date.now();
        inMemorySearchCache.set(key, results, remainingTtl);
        return { hit: true, tier: 'mongo', results };
      }
    }
  } catch (err) {
    // Non-fatal if Mongo read fails; fail-open to fresh retrieval
    console.warn('SearchCache Tier 2 Mongo read error:', err);
  }

  return { hit: false };
}

/**
 * Persist search results to both Tier 1 (LRU) and Tier 2 (MongoDB searchCache).
 */
export async function setCachedSearch(
  normalizedQuery: string,
  provider: 'tavily' | 'serpapi',
  results: SearchResultItem[]
): Promise<void> {
  const key = searchCacheKey(normalizedQuery, provider);
  const ttlMs = env.searchCacheTtlSeconds * 1000;

  // Store in Tier 1
  inMemorySearchCache.set(key, results, ttlMs);

  // Store in Tier 2 (MongoDB)
  try {
    const col = await searchCacheCollection();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    await col.updateOne(
      { _id: key },
      {
        $set: {
          provider,
          query: normalizedQuery,
          results: results as unknown as Array<Record<string, unknown>>,
          expiresAt,
          createdAt: now
        }
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn('SearchCache Tier 2 Mongo write error:', err);
  }
}

let searchCacheHits = 0;
let searchCacheTotal = 0;

export function recordSearchCacheQuery(hit: boolean): void {
  searchCacheTotal++;
  if (hit) searchCacheHits++;
}

export function getSearchCacheStats(): { hits: number; total: number; hitRatePct: number } {
  return {
    hits: searchCacheHits,
    total: searchCacheTotal,
    hitRatePct: searchCacheTotal > 0 ? Number(((searchCacheHits / searchCacheTotal) * 100).toFixed(1)) : 0
  };
}

/**
 * Execute a web search with two-tier cache wrapper.
 */
export async function cachedWebSearch(
  input: WebSearchInput,
  provider: 'tavily' | 'serpapi' = env.searchProvider
): Promise<CachedSearchResult> {
  const normalized = normalizeQuery(input.query);
  const cached = await getCachedSearch(normalized, provider);
  recordSearchCacheQuery(cached.hit);

  if (cached.hit && cached.results) {
    return {
      query: input.query,
      normalizedQuery: normalized,
      provider,
      results: cached.results,
      cached: true,
      tier: cached.tier
    };
  }

  // Cache miss: execute live search
  const fresh = await executeWebSearch(input, provider);

  // Persist to two-tier cache
  await setCachedSearch(normalized, provider, fresh.results);

  return {
    ...fresh,
    cached: false
  };
}
