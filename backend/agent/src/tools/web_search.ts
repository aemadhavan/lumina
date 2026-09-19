import { createHash } from 'node:crypto';
import { env, secrets } from '../env.js';

export interface WebSearchInput {
  query: string;
  limit?: number;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  fetchedContent?: string;
  fetchedTitle?: string;
}

export interface WebSearchResult {
  query: string;
  normalizedQuery: string;
  provider: 'tavily' | 'serpapi';
  results: SearchResultItem[];
}

export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function searchCacheKey(normalizedQuery: string, provider: 'tavily' | 'serpapi'): string {
  return createHash('sha256').update(`${normalizedQuery}:${provider}`).digest('hex');
}

async function searchTavily(query: string, limit = 5): Promise<SearchResultItem[]> {
  if (!secrets.tavily) {
    throw new Error('TAVILY_API_KEY is not set — required for Tavily search provider');
  }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: secrets.tavily,
      query,
      max_results: limit,
      include_answer: false,
      search_depth: 'basic'
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Tavily search upstream failure (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (data.results ?? []).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    snippet: r.content ?? ''
  }));
}

async function searchSerpApi(query: string, limit = 5): Promise<SearchResultItem[]> {
  if (!secrets.serpapi) {
    throw new Error('SERPAPI_API_KEY is not set — required for SerpApi search provider');
  }

  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('api_key', secrets.serpapi);
  url.searchParams.set('q', query);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('num', String(limit));

  const res = await fetch(url.toString(), {
    method: 'GET',
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`SerpApi search upstream failure (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as {
    organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return (data.organic_results ?? []).slice(0, limit).map((r) => ({
    title: r.title ?? '',
    url: r.link ?? '',
    snippet: r.snippet ?? ''
  }));
}

export async function executeWebSearch(
  input: WebSearchInput,
  provider: 'tavily' | 'serpapi' = env.searchProvider
): Promise<WebSearchResult> {
  const normalized = normalizeQuery(input.query);
  const limit = input.limit ?? 5;
  let results: SearchResultItem[];

  if (provider === 'serpapi') {
    results = await searchSerpApi(normalized, limit);
  } else {
    results = await searchTavily(normalized, limit);
  }

  return {
    query: input.query,
    normalizedQuery: normalized,
    provider,
    results
  };
}
