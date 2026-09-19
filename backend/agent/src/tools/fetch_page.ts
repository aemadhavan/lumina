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

export const inMemoryPageCache = new Map<string, FetchPageResult>();

function extractHtmlText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = (titleMatch && titleMatch[1]) ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  const title = rawTitle
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  return { title, text };
}

export async function executeFetchPage(input: FetchPageInput): Promise<FetchPageResult> {
  const { url, maxChars = 20000, timeoutMs = 1500 } = input;
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
  const { title, text } = extractHtmlText(html);

  let content = text;
  if (maxChars && content.length > maxChars) {
    content = content.slice(0, maxChars) + '...';
  }

  const result: FetchPageResult = {
    url,
    title: title || url,
    content
  };
  inMemoryPageCache.set(url, result);
  return result;
}

