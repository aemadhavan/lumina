import { randomUUID } from 'node:crypto';
import type {
  Depth,
  DoneEvent,
  Source,
  TraceEvent,
  Terminated,
  ToolName
} from '@lumina/contract';
import { env } from './env.js';
import { cachedWebSearch } from './cache.js';
import { executeFetchPage } from './tools/fetch_page.js';
import { saveMemory, recallMemory } from './tools/memory.js';
import { searchDocuments, formatDocSources } from './tools/search_documents.js';
import { streamLLMCompletion, type LLMMessage } from './llm.js';

export interface LoopOptions {
  query: string;
  depth?: Depth;
  mode?: 'auto' | 'web' | 'docs';
  spaceId?: string;
  threadId?: string;
  userId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  onTrace?: (event: TraceEvent) => void;
  onSources?: (sources: Source[]) => void;
  onToken?: (token: string) => void;
}

export interface LoopResult {
  answerId: string;
  text: string;
  sources: Source[];
  traces: TraceEvent[];
  done: DoneEvent;
  toolCallsLog: Array<{ name: ToolName; ok: boolean; error?: string; ms?: number }>;
  ttftMs: number;
  latencyMs: number;
}

/**
 * Calculate cost in USD based on benchmark pricing model
 */
export function calculateCost(tokensIn: number, tokensOut: number, searchCalls: number): number {
  const tokenCost = (tokensIn * 3.0 + tokensOut * 15.0) / 1_000_000;
  const searchCost = searchCalls * 0.008;
  return Number((tokenCost + searchCost).toFixed(5));
}

/**
 * Extract a grounded snippet from text (taking a window of contiguous whole words around query terms)
 */
export function extractGroundedSnippet(text: string, query: string, targetWords = 35): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(Boolean);
  if (words.length <= targetWords) return words.join(' ');

  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  let bestWordIdx = -1;

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!.toLowerCase();
    if (queryTerms.some((t) => w.includes(t))) {
      bestWordIdx = i;
      break;
    }
  }

  let startIdx = 0;
  if (bestWordIdx !== -1) {
    startIdx = Math.max(0, bestWordIdx - 4);
  }
  const endIdx = Math.min(words.length, startIdx + targetWords);
  const snippet = words.slice(startIdx, endIdx).join(' ');
  return snippet;
}

/**
 * Execute the Quick ReAct loop
 */
export async function runQuickLoop(options: LoopOptions): Promise<LoopResult> {
  const startedAt = Date.now();
  const answerId = `ans_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const maxTools = env.maxToolCalls;
  const maxWallClockMs = env.maxWallClockSec * 1000;

  const traces: TraceEvent[] = [];
  const toolCallsLog: Array<{ name: ToolName; ok: boolean; error?: string; ms?: number }> = [];
  let step = 1;
  let searchCalls = 0;
  let allSearchesCached = true;
  let terminated: Terminated = 'done';
  let ttftMs = 0;

  const isCapReached = () => {
    if (toolCallsLog.length >= maxTools) return 'tool_cap';
    if (Date.now() - startedAt >= maxWallClockMs) return 'time_cap';
    return null;
  };

  const fetchedPages: Array<{ url: string; title: string; content: string }> = [];

  // Step 0: Check if query is an explicit request to remember a fact or preference
  const memorySaveRegex = /^(?:please\s+)?remember(?:\s+this)?(?:\s+preference)?(?:\s+for\s+all\s+future\s+answers)?(?:\s*:\s*|\s+that\s+|\s+)(.+)$/i;
  const memoryMatch = options.query.match(memorySaveRegex);
  const isPureMemorySave = Boolean(
    memoryMatch ||
    /\b(remember\s+(this|my|that)|save\s+(to\s+memory|this\s+preference))\b/i.test(options.query)
  );

  if (options.userId && isPureMemorySave && !isCapReached()) {
    const textToSave = (memoryMatch && memoryMatch[1]) ? memoryMatch[1].trim() : options.query.trim();
    const memStart = Date.now();
    try {
      await saveMemory({
        userId: options.userId,
        text: textToSave,
        sourceThread: options.threadId
      });
      const memMs = Date.now() - memStart;
      const saveTrace: TraceEvent = {
        step: step++,
        tool: 'save_memory',
        input: { text: textToSave },
        ok: true,
        ms: memMs,
        reason: `saved preference to long-term memory: "${textToSave.slice(0, 60)}"`
      };
      traces.push(saveTrace);
      toolCallsLog.push({ name: 'save_memory', ok: true, ms: memMs });
      options.onTrace?.(saveTrace);
    } catch (memErr) {
      const memMs = Date.now() - memStart;
      const errMsg = (memErr as Error).message;
      const saveTrace: TraceEvent = {
        step: step++,
        tool: 'save_memory',
        input: { text: textToSave },
        ok: false,
        ms: memMs,
        error: errMsg
      };
      traces.push(saveTrace);
      toolCallsLog.push({ name: 'save_memory', ok: false, error: errMsg, ms: memMs });
      options.onTrace?.(saveTrace);
    }

    // Pure memory save: confirm directly without web search
    options.onSources?.([]);
    const confirmationText = `I have remembered this preference for all future answers: ${textToSave}`;
    ttftMs = Date.now() - startedAt;
    options.onToken?.(confirmationText);

    const latencyMs = Date.now() - startedAt;
    const done: DoneEvent = {
      answerId,
      latencyMs,
      ttftMs,
      model: env.llmModel,
      tokens: { in: 10, out: 15 },
      costUsd: calculateCost(10, 15, 0),
      searchCached: false,
      terminated,
      depth: 'quick'
    };

    return {
      answerId,
      text: confirmationText,
      sources: [],
      traces,
      done,
      toolCallsLog,
      ttftMs,
      latencyMs
    };
  }

  // Recalled memories container
  let recalledMemories: Array<{ memoryId: string; text: string; score?: number }> = [];

  // Sources container
  const sources: Source[] = [];

  // Parallel initial retrieval: memory recall runs concurrently with search
  const recallPromise = (options.userId && !isCapReached())
    ? (async () => {
        const recallStart = Date.now();
        try {
          const recalled = await recallMemory({
            userId: options.userId!,
            query: options.query,
            limit: 3
          });
          const recallMs = Date.now() - recallStart;
          return { ok: true as const, recalled, ms: recallMs };
        } catch (recallErr) {
          const recallMs = Date.now() - recallStart;
          return { ok: false as const, error: (recallErr as Error).message, ms: recallMs };
        }
      })()
    : null;

  const shouldUseDocs = (options.mode === 'docs' || options.mode === 'auto') && Boolean(options.spaceId);
  const docSearchPromise = (shouldUseDocs && !isCapReached())
    ? (async () => {
        const docStart = Date.now();
        try {
          const fusedResults = await searchDocuments({
            spaceId: options.spaceId!,
            query: options.query,
            limit: 5,
            userId: options.userId
          });
          const docMs = Date.now() - docStart;
          return { ok: true as const, fusedResults, ms: docMs };
        } catch (docErr) {
          const docMs = Date.now() - docStart;
          return { ok: false as const, error: (docErr as Error).message || 'Document retrieval failed', ms: docMs, rawErr: docErr };
        }
      })()
    : null;

  const isDirectWeb = options.mode === 'web';
  const webSearchPromise = (isDirectWeb && !isCapReached())
    ? (async () => {
        const searchStart = Date.now();
        try {
          const searchRes = await cachedWebSearch({ query: options.query });
          const ms = Date.now() - searchStart;
          return { ok: true as const, searchRes, ms };
        } catch (searchErr) {
          const ms = Date.now() - searchStart;
          return { ok: false as const, error: (searchErr as Error).message || 'Search provider failure', ms, rawErr: searchErr };
        }
      })()
    : null;

  // Wait for initial parallel operations
  const [recallRes, docRes, webRes] = await Promise.all([
    recallPromise,
    docSearchPromise,
    webSearchPromise
  ]);

  // Step 1: Record recall_memory trace in deterministic sequence
  if (recallRes) {
    if (recallRes.ok) {
      const recallTrace: TraceEvent = {
        step: step++,
        tool: 'recall_memory',
        input: { query: options.query },
        ok: true,
        ms: recallRes.ms,
        reason: recallRes.recalled.length > 0
          ? `recalled ${recallRes.recalled.length} relevant long-term preference(s)`
          : 'no matching long-term memories found'
      };
      traces.push(recallTrace);
      toolCallsLog.push({ name: 'recall_memory', ok: true, ms: recallRes.ms });
      options.onTrace?.(recallTrace);
      if (recallRes.recalled.length > 0) {
        recalledMemories = recallRes.recalled;
      }
    } else {
      const recallTrace: TraceEvent = {
        step: step++,
        tool: 'recall_memory',
        input: { query: options.query },
        ok: false,
        ms: recallRes.ms,
        error: recallRes.error
      };
      traces.push(recallTrace);
      toolCallsLog.push({ name: 'recall_memory', ok: false, error: recallRes.error, ms: recallRes.ms });
      options.onTrace?.(recallTrace);
    }
  }

  // Step 2A: Record search_documents trace in deterministic sequence
  if (docRes) {
    if (docRes.ok) {
      const docTrace: TraceEvent = {
        step: step++,
        tool: 'search_documents',
        input: { spaceId: options.spaceId, query: options.query },
        ok: true,
        ms: docRes.ms,
        reason: docRes.fusedResults.length > 0
          ? `hybrid RRF retrieval returned ${docRes.fusedResults.length} relevant chunk(s)`
          : 'no matching document chunks found in space'
      };
      traces.push(docTrace);
      toolCallsLog.push({ name: 'search_documents', ok: true, ms: docRes.ms });
      options.onTrace?.(docTrace);
      if (docRes.fusedResults.length > 0) {
        const docSources = formatDocSources(docRes.fusedResults, sources.length + 1);
        sources.push(...docSources);
      }
    } else {
      const docTrace: TraceEvent = {
        step: step++,
        tool: 'search_documents',
        input: { spaceId: options.spaceId, query: options.query },
        ok: false,
        ms: docRes.ms,
        error: docRes.error
      };
      traces.push(docTrace);
      toolCallsLog.push({ name: 'search_documents', ok: false, error: docRes.error, ms: docRes.ms });
      options.onTrace?.(docTrace);
      if (options.mode === 'docs') {
        throw docRes.rawErr;
      }
    }
  }

  // Step 2B: Web search (either direct or fallback if auto mode had 0 doc hits)
  let activeWebRes = webRes;
  if (!activeWebRes && (options.mode === 'web' || (options.mode !== 'docs' && sources.length === 0)) && !isCapReached()) {
    const searchStart = Date.now();
    try {
      const searchRes = await cachedWebSearch({ query: options.query });
      const ms = Date.now() - searchStart;
      activeWebRes = { ok: true, searchRes, ms };
    } catch (searchErr) {
      const ms = Date.now() - searchStart;
      activeWebRes = { ok: false, error: (searchErr as Error).message || 'Search provider failure', ms, rawErr: searchErr };
    }
  }

  if (activeWebRes) {
    if (activeWebRes.ok) {
      searchCalls++;
      if (!activeWebRes.searchRes.cached) {
        allSearchesCached = false;
      }

      const traceEv: TraceEvent = {
        step: step++,
        tool: 'web_search',
        input: { query: options.query },
        ok: true,
        ms: activeWebRes.ms,
        reason: activeWebRes.searchRes.cached
          ? `cache hit (${activeWebRes.searchRes.tier})`
          : `retrieved ${activeWebRes.searchRes.results.length} results from ${activeWebRes.searchRes.provider}`
      };
      traces.push(traceEv);
      toolCallsLog.push({ name: 'web_search', ok: true, ms: activeWebRes.ms });
      options.onTrace?.(traceEv);

      // Filter out PDF and video URLs that lack readable HTML article content
      const candidateUrls = Array.from(new Set(activeWebRes.searchRes.results.map((r) => r.url)))
        .filter((u) => u && !u.endsWith('.pdf') && !u.includes('youtube.com') && !u.includes('youtu.be') && !u.includes('vimeo.com'));

      for (const url of candidateUrls.slice(0, 1)) {
        if (isCapReached()) {
          break;
        }

        const fetchStart = Date.now();
        try {
          const pageRes = await executeFetchPage({ url, maxChars: 10000, timeoutMs: 220 });
          const fetchMs = Date.now() - fetchStart;
          if (pageRes.content && pageRes.content.length >= 250) {
            const fetchTrace: TraceEvent = {
              step: step++,
              tool: 'fetch_page',
              input: { url },
              ok: true,
              ms: fetchMs,
              reason: `fetched ${pageRes.content.length} chars: ${pageRes.title}`
            };
            traces.push(fetchTrace);
            toolCallsLog.push({ name: 'fetch_page', ok: true, ms: fetchMs });
            options.onTrace?.(fetchTrace);
            fetchedPages.push(pageRes);
            break; // Stop immediately once we have a high-quality article page
          }
        } catch (fetchErr) {
          const fetchMs = Date.now() - fetchStart;
          const errMsg = (fetchErr as Error).message || 'Failed to fetch page';
          const fetchTrace: TraceEvent = {
            step: step++,
            tool: 'fetch_page',
            input: { url },
            ok: false,
            ms: fetchMs,
            error: errMsg
          };
          traces.push(fetchTrace);
          toolCallsLog.push({ name: 'fetch_page', ok: false, error: errMsg, ms: fetchMs });
          options.onTrace?.(fetchTrace);
        }
      }

      // If page fetch timed out or failed, fall back to search snippet as allowed by contract
      if (fetchedPages.length === 0 && activeWebRes.searchRes.results.length > 0) {
        const topResult = activeWebRes.searchRes.results.find((r) => r.snippet && r.snippet.length >= 80) || activeWebRes.searchRes.results[0];
        if (topResult && topResult.snippet) {
          fetchedPages.push({
            url: topResult.url,
            title: topResult.title || topResult.url,
            content: topResult.snippet
          });
          const snippetTrace: TraceEvent = {
            step: step++,
            tool: 'fetch_page',
            input: { url: topResult.url },
            ok: true,
            ms: 1,
            reason: 'fell back to search snippet'
          };
          traces.push(snippetTrace);
          toolCallsLog.push({ name: 'fetch_page', ok: true, ms: 1 });
          options.onTrace?.(snippetTrace);
        }
      }
    } else {
      const searchTrace: TraceEvent = {
        step: step++,
        tool: 'web_search',
        input: { query: options.query },
        ok: false,
        ms: activeWebRes.ms,
        error: activeWebRes.error
      };
      traces.push(searchTrace);
      toolCallsLog.push({ name: 'web_search', ok: false, error: activeWebRes.error, ms: activeWebRes.ms });
      options.onTrace?.(searchTrace);
      throw activeWebRes.rawErr;
    }
  } else if (isCapReached()) {
    terminated = 'cap';
  }

  // Construct grounded web sources
  for (const page of fetchedPages) {
    const snippet = extractGroundedSnippet(page.content, options.query);
    if (snippet && snippet.length >= 20) {
      sources.push({
        n: sources.length + 1,
        kind: 'web',
        title: page.title || page.url,
        url: page.url,
        snippet
      });
    }
  }

  // CRITICAL: Emit sources BEFORE the first token!
  options.onSources?.(sources);

  // If no retrieval happened, return grounded empty message
  if (sources.length === 0) {
    const emptyMsg = options.mode === 'docs'
      ? "I couldn't find any relevant passages in the documents for your query."
      : "I couldn't find any relevant sources for your query.";
    ttftMs = Date.now() - startedAt;
    options.onToken?.(emptyMsg);

    const latencyMs = Date.now() - startedAt;
    const tokensIn = 20;
    const tokensOut = 15;
    const done: DoneEvent = {
      answerId,
      latencyMs,
      ttftMs,
      model: env.llmModel,
      tokens: { in: tokensIn, out: tokensOut },
      costUsd: calculateCost(tokensIn, tokensOut, searchCalls),
      searchCached: allSearchesCached && searchCalls > 0,
      terminated,
      depth: 'quick'
    };

    return {
      answerId,
      text: emptyMsg,
      sources: [],
      traces,
      done,
      toolCallsLog,
      ttftMs,
      latencyMs
    };
  }

  // Build grounded prompt for synthesis
  const sourceContext = sources
    .map((s) => {
      if (s.kind === 'doc') {
        const loc = s.locator?.page !== undefined
          ? `Page: ${s.locator.page}`
          : s.locator?.heading
            ? `Heading: "${s.locator.heading}"`
            : s.locator?.line !== undefined
              ? `Line: ${s.locator.line}`
              : '';
        return `[${s.n}] Document: "${s.title}" ${loc ? `(${loc})` : ''}\nContent:\n${s.snippet}`;
      }
      return `[${s.n}] Source Title: "${s.title}"\nURL: ${s.url}\nExcerpt:\n${s.snippet}`;
    })
    .join('\n\n');

  let systemPrompt = `You are Lumina, an intelligent and grounded research assistant.
Rules for answering:
1. Synthesize a comprehensive, accurate response to the user's question using ONLY the provided sources.
2. Grounding is mandatory: every factual claim MUST include a citation [n] matching the source number.
3. Every [n] in your answer must strictly map to one of the numbered sources provided below.
4. Do not invent facts, citations, or URLs.
5. If the sources do not contain enough information, state clearly what is known and what is missing.`;

  if (recalledMemories.length > 0) {
    systemPrompt += `\n\nUser Preferences from Long-Term Memory:\n${recalledMemories.map((m) => `- ${m.text}`).join('\n')}\nStrictly adhere to these user preferences in your response.`;
  }

  const userPrompt = `User Question: "${options.query}"

Retrieved Sources:
${sourceContext}

Please provide a well-structured, clear, and thoroughly cited answer.`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt }
  ];

  if (options.history && options.history.length > 0) {
    for (const h of options.history) {
      messages.push({ role: h.role, content: h.content });
    }
  }
  messages.push({ role: 'user', content: userPrompt });

  let firstTokenEmitted = false;
  let fullText = '';

  const streamRes = await streamLLMCompletion({
    messages,
    systemPrompt,
    maxTokens: 800,
    onToken: (tok) => {
      if (!firstTokenEmitted) {
        firstTokenEmitted = true;
        ttftMs = Date.now() - startedAt;
      }
      fullText += tok;
      options.onToken?.(tok);
    }
  });

  const latencyMs = Date.now() - startedAt;
  if (!ttftMs) ttftMs = latencyMs;

  const costUsd = calculateCost(streamRes.tokensIn, streamRes.tokensOut, searchCalls);

  const done: DoneEvent = {
    answerId,
    latencyMs,
    ttftMs,
    model: streamRes.model,
    tokens: { in: streamRes.tokensIn, out: streamRes.tokensOut },
    costUsd,
    searchCached: allSearchesCached && searchCalls > 0,
    terminated,
    depth: 'quick'
  };

  return {
    answerId,
    text: fullText,
    sources,
    traces,
    done,
    toolCallsLog,
    ttftMs,
    latencyMs
  };
}
