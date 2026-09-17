import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';

export interface FetchPageInput {
  url: string;
  maxChars?: number;
  timeoutMs?: number;
}

export interface FetchPageResult {
  url: string;
  title: string;
  content: string;
  byline?: string;
  excerpt?: string;
}

const inMemoryPageCache = new Map<string, FetchPageResult>();

export async function executeFetchPage(input: FetchPageInput): Promise<FetchPageResult> {
  const { url, maxChars = 20000, timeoutMs = 2500 } = input;
  if (inMemoryPageCache.has(url)) {
    return inMemoryPageCache.get(url)!;
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Lumina/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch page (${res.status} ${res.statusText}): ${url}`);
  }

  const html = await res.text();
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', () => {}); // Suppress non-critical CSS/DOM parse errors
  const dom = new JSDOM(html, { url, virtualConsole });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  let content = article?.textContent ?? dom.window.document.body?.textContent ?? '';
  // Clean up whitespace while preserving paragraphs
  content = content
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  if (maxChars && content.length > maxChars) {
    content = content.slice(0, maxChars) + '...';
  }

  const result: FetchPageResult = {
    url,
    title: article?.title ?? dom.window.document.title ?? url,
    content,
    byline: article?.byline ?? undefined,
    excerpt: article?.excerpt ?? undefined
  };
  inMemoryPageCache.set(url, result);
  return result;
}
