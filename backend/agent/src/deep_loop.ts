import { randomUUID } from 'node:crypto';
import type {
  DoneEvent,
  PlanEvent,
  Source,
  TraceEvent,
  Terminated,
  ToolName
} from '@lumina/contract';
import { env } from './env.js';
import { cachedWebSearch } from './cache.js';
import { executeFetchPage } from './tools/fetch_page.js';
import { recallMemory } from './tools/memory.js';
import { searchDocuments } from './tools/search_documents.js';
import { planResearch } from './tools/plan_research.js';
import { streamLLMCompletion, type LLMMessage } from './llm.js';
import { calculateCost, extractGroundedSnippet } from './loop.js';

export interface DeepLoopOptions {
  query: string;
  mode?: 'auto' | 'web' | 'docs';
  spaceId?: string;
  threadId?: string;
  userId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  onPlan?: (plan: PlanEvent) => void;
  onTrace?: (event: TraceEvent) => void;
  onSources?: (sources: Source[]) => void;
  onToken?: (token: string) => void;
}

export interface DeepLoopResult {
  answerId: string;
  text: string;
  plan: PlanEvent;
  sources: Source[];
  traces: TraceEvent[];
  done: DoneEvent;
  toolCallsLog: Array<{ name: ToolName; ok: boolean; error?: string; ms?: number }>;
  ttftMs: number;
  latencyMs: number;
}

/**
 * Execute the Deep Research loop with query decomposition, pre-retrieval plan streaming,
 * multi-question fan-out, trace attribution, and unified contiguous citation merging.
 */
export async function runDeepLoop(options: DeepLoopOptions): Promise<DeepLoopResult> {
  const startedAt = Date.now();
  const answerId = `ans_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

  // Deep caps: max 24 tool calls, max 240s wall-clock time
  const maxTools = 24;
  const maxWallClockMs = 240 * 1000;

  const traces: TraceEvent[] = [];
  const toolCallsLog: Array<{ name: ToolName; ok: boolean; error?: string; ms?: number }> = [];
  let step = 1;
  let searchCalls = 0;
  let allSearchesCached = true;
  let terminated: Terminated = 'done';
  let ttftMs = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  const isCapReached = () => {
    if (toolCallsLog.length >= maxTools) return 'tool_cap';
    if (Date.now() - startedAt >= maxWallClockMs) return 'time_cap';
    return null;
  };

  // Step 1: Query Decomposition via plan_research
  // CRITICAL: plan event MUST be emitted before ANY other operation or retrieval!
  const planStart = Date.now();
  let planEvent: PlanEvent;

  try {
    const planResult = await planResearch({ query: options.query });
    totalTokensIn += planResult.tokensIn;
    totalTokensOut += planResult.tokensOut;
    planEvent = planResult.plan;

    const planMs = Date.now() - planStart;
    const planTrace: TraceEvent = {
      step: step++,
      tool: 'plan_research',
      input: { query: options.query },
      ok: true,
      ms: planMs,
      reason: `decomposed query into ${planEvent.subQuestions.length} sub-questions`
    };
    traces.push(planTrace);
    toolCallsLog.push({ name: 'plan_research', ok: true, ms: planMs });
    options.onTrace?.(planTrace);

    // EMIT PLAN EVENT BEFORE RETRIEVAL
    options.onPlan?.(planEvent);
  } catch (err) {
    const planMs = Date.now() - planStart;
    const errMsg = (err as Error).message || 'Planning failed';
    const planTrace: TraceEvent = {
      step: step++,
      tool: 'plan_research',
      input: { query: options.query },
      ok: false,
      ms: planMs,
      error: errMsg
    };
    traces.push(planTrace);
    toolCallsLog.push({ name: 'plan_research', ok: false, error: errMsg, ms: planMs });
    options.onTrace?.(planTrace);
    throw err;
  }

  // Step 2: Memory Recall (if authenticated)
  let recalledMemories: Array<{ memoryId: string; text: string }> = [];
  if (options.userId && !isCapReached()) {
    const recallStart = Date.now();
    try {
      const recalled = await recallMemory({
        userId: options.userId,
        query: options.query,
        limit: 3
      });
      const recallMs = Date.now() - recallStart;
      const recallTrace: TraceEvent = {
        step: step++,
        tool: 'recall_memory',
        input: { query: options.query },
        ok: true,
        ms: recallMs,
        reason: recalled.length > 0
          ? `recalled ${recalled.length} long-term user preference(s)`
          : 'no matching long-term memories found'
      };
      traces.push(recallTrace);
      toolCallsLog.push({ name: 'recall_memory', ok: true, ms: recallMs });
      options.onTrace?.(recallTrace);
      recalledMemories = recalled;
    } catch (recallErr) {
      const recallMs = Date.now() - recallStart;
      const errMsg = (recallErr as Error).message;
      const recallTrace: TraceEvent = {
        step: step++,
        tool: 'recall_memory',
        input: { query: options.query },
        ok: false,
        ms: recallMs,
        error: errMsg
      };
      traces.push(recallTrace);
      toolCallsLog.push({ name: 'recall_memory', ok: false, error: errMsg, ms: recallMs });
      options.onTrace?.(recallTrace);
    }
  }

  // Step 3: Multi-question Research Fan-out
  // Raw collected sources before unified deduplication
  const rawSources: Source[] = [];
  const fetchedPagesMap = new Map<string, { url: string; title: string; content: string }>();

  const isDocMode = (options.mode === 'docs' || options.mode === 'auto') && Boolean(options.spaceId);

  for (const sq of planEvent.subQuestions) {
    if (isCapReached()) {
      terminated = 'cap';
      break;
    }

    // 3A. Document Retrieval if in space
    if (isDocMode) {
      const docStart = Date.now();
      try {
        const fused = await searchDocuments({
          spaceId: options.spaceId!,
          query: sq.question,
          limit: 3,
          userId: options.userId
        });
        const docMs = Date.now() - docStart;
        const docTrace: TraceEvent = {
          step: step++,
          tool: 'search_documents',
          input: { spaceId: options.spaceId, query: sq.question },
          ok: true,
          ms: docMs,
          subQuestion: sq.i,
          reason: fused.length > 0
            ? `retrieved ${fused.length} doc chunks for sub-question ${sq.i}`
            : `no chunks found for sub-question ${sq.i}`
        };
        traces.push(docTrace);
        toolCallsLog.push({ name: 'search_documents', ok: true, ms: docMs });
        options.onTrace?.(docTrace);

        for (const item of fused) {
          rawSources.push({
            n: 0, // will renumber contiguously
            kind: 'doc',
            title: item.title,
            snippet: item.chunk.text,
            docId: item.chunk.docId as any,
            locator: item.chunk.locator,
            subQuestion: sq.i
          });
        }
      } catch (docErr) {
        const docMs = Date.now() - docStart;
        const errMsg = (docErr as Error).message || 'Doc search failed';
        const docTrace: TraceEvent = {
          step: step++,
          tool: 'search_documents',
          input: { spaceId: options.spaceId, query: sq.question },
          ok: false,
          ms: docMs,
          subQuestion: sq.i,
          error: errMsg
        };
        traces.push(docTrace);
        toolCallsLog.push({ name: 'search_documents', ok: false, error: errMsg, ms: docMs });
        options.onTrace?.(docTrace);
      }
    }

    // 3B. Web Retrieval (if mode is web, or auto, or no doc matches)
    const runWeb = options.mode === 'web' || options.mode === 'auto' || !isDocMode;
    if (runWeb && !isCapReached()) {
      const searchStart = Date.now();
      try {
        const searchRes = await cachedWebSearch({ query: sq.question });
        searchCalls++;
        if (!searchRes.cached) allSearchesCached = false;

        const ms = Date.now() - searchStart;
        const searchTrace: TraceEvent = {
          step: step++,
          tool: 'web_search',
          input: { query: sq.question },
          ok: true,
          ms,
          subQuestion: sq.i,
          reason: searchRes.cached
            ? `cache hit (${searchRes.tier}) for sub-question ${sq.i}`
            : `retrieved ${searchRes.results.length} web results for sub-question ${sq.i}`
        };
        traces.push(searchTrace);
        toolCallsLog.push({ name: 'web_search', ok: true, ms });
        options.onTrace?.(searchTrace);

        // Fetch top 1-2 distinct URLs for this sub-question
        const urlsToFetch = Array.from(new Set(searchRes.results.map((r) => r.url)))
          .filter((u) => u && !u.endsWith('.pdf'))
          .slice(0, 2);

        for (const url of urlsToFetch) {
          if (isCapReached()) {
            terminated = 'cap';
            break;
          }

          let page = fetchedPagesMap.get(url);
          if (!page) {
            const fetchStart = Date.now();
            try {
              page = await executeFetchPage({ url, maxChars: 12000 });
              const fetchMs = Date.now() - fetchStart;
              const fetchTrace: TraceEvent = {
                step: step++,
                tool: 'fetch_page',
                input: { url },
                ok: true,
                ms: fetchMs,
                subQuestion: sq.i,
                reason: `fetched ${page.content.length} chars for sub-question ${sq.i}`
              };
              traces.push(fetchTrace);
              toolCallsLog.push({ name: 'fetch_page', ok: true, ms: fetchMs });
              options.onTrace?.(fetchTrace);
              fetchedPagesMap.set(url, page);
            } catch (fetchErr) {
              const fetchMs = Date.now() - fetchStart;
              const errMsg = (fetchErr as Error).message || 'Fetch failed';
              const fetchTrace: TraceEvent = {
                step: step++,
                tool: 'fetch_page',
                input: { url },
                ok: false,
                ms: fetchMs,
                subQuestion: sq.i,
                error: errMsg
              };
              traces.push(fetchTrace);
              toolCallsLog.push({ name: 'fetch_page', ok: false, error: errMsg, ms: fetchMs });
              options.onTrace?.(fetchTrace);
            }
          }

          if (page) {
            const snippet = extractGroundedSnippet(page.content, sq.question);
            if (snippet && snippet.length >= 20) {
              rawSources.push({
                n: 0,
                kind: 'web',
                title: page.title || page.url,
                url: page.url,
                snippet,
                subQuestion: sq.i
              });
            }
          }
        }
      } catch (searchErr) {
        const searchMs = Date.now() - searchStart;
        const errMsg = (searchErr as Error).message || 'Web search failed';
        const searchTrace: TraceEvent = {
          step: step++,
          tool: 'web_search',
          input: { query: sq.question },
          ok: false,
          ms: searchMs,
          subQuestion: sq.i,
          error: errMsg
        };
        traces.push(searchTrace);
        toolCallsLog.push({ name: 'web_search', ok: false, error: errMsg, ms: searchMs });
        options.onTrace?.(searchTrace);
        // Do not crash the entire fan-out on a single sub-question search failure unless all fail
      }
    }
  }

  // Step 4: Unified Citation Merging & Contiguous Renumbering [1..N]
  const mergedSources: Source[] = [];
  const seenKeys = new Set<string>();

  for (const src of rawSources) {
    const key = src.kind === 'web'
      ? `web:${src.url}`
      : `doc:${src.docId}:${src.locator?.page ?? src.locator?.heading ?? src.locator?.line ?? 'all'}`;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      mergedSources.push({
        ...src,
        n: mergedSources.length + 1 // contiguous 1..N
      });
    }
  }

  // CRITICAL: Emit sources BEFORE the first token!
  options.onSources?.(mergedSources);

  // If no sources were retrieved across all sub-questions
  if (mergedSources.length === 0) {
    const emptyMsg = "I couldn't find any relevant sources for the research plan.";
    ttftMs = Date.now() - startedAt;
    options.onToken?.(emptyMsg);

    const latencyMs = Date.now() - startedAt;
    const tokensIn = totalTokensIn + 20;
    const tokensOut = totalTokensOut + 15;
    const costUsd = calculateCost(tokensIn, tokensOut, searchCalls);

    const done: DoneEvent = {
      answerId,
      latencyMs,
      ttftMs,
      model: env.llmModel,
      tokens: { in: tokensIn, out: tokensOut },
      costUsd,
      searchCached: allSearchesCached && searchCalls > 0,
      terminated,
      depth: 'deep',
      subQuestions: planEvent.subQuestions.length
    };

    return {
      answerId,
      text: emptyMsg,
      plan: planEvent,
      sources: [],
      traces,
      done,
      toolCallsLog,
      ttftMs,
      latencyMs
    };
  }

  // Step 5: Structured Answer Synthesis
  const sourceContext = mergedSources
    .map((s) => {
      const subTag = s.subQuestion ? `[Sub-Question ${s.subQuestion}] ` : '';
      if (s.kind === 'doc') {
        const loc = s.locator?.page !== undefined
          ? `Page ${s.locator.page}`
          : s.locator?.heading
            ? `Heading "${s.locator.heading}"`
            : '';
        return `[${s.n}] ${subTag}Document: "${s.title}" ${loc ? `(${loc})` : ''}\nContent:\n${s.snippet}`;
      }
      return `[${s.n}] ${subTag}Web Source: "${s.title}"\nURL: ${s.url}\nExcerpt:\n${s.snippet}`;
    })
    .join('\n\n');

  const subQuestionList = planEvent.subQuestions
    .map((sq) => `${sq.i}. ${sq.question}`)
    .join('\n');

  let systemPrompt = `You are Lumina, a deep research intelligence system.
You are synthesizing an exhaustive, multi-part research report based on a decomposed investigation plan.
Requirements:
1. Structure the response clearly:
   - **Executive Summary**: Direct, high-level synthesis addressing the core user question.
   - **Detailed Findings**: A dedicated markdown section for each sub-question explored.
   - **Remaining Unknowns**: Any nuances, open questions, or missing evidence that could not be verified from the retrieved sources.
2. Grounding is mandatory: Every factual statement must cite one or more sources using [n] notation.
3. Every [n] citation must correspond exactly to one source in the provided sources list (1 to ${mergedSources.length}).
4. Do not invent citations, URLs, or facts. Synthesize solely from the retrieved evidence.`;

  if (recalledMemories.length > 0) {
    systemPrompt += `\n\nUser Preferences from Long-Term Memory:\n${recalledMemories.map((m) => `- ${m.text}`).join('\n')}\nStrictly respect these user preferences in your writing style and structure.`;
  }

  const userPrompt = `Core Question: "${options.query}"

Research Plan Sub-Questions:
${subQuestionList}

Retrieved Evidence (${mergedSources.length} sources):
${sourceContext}

Please provide the exhaustive research report with strict [n] citations:`;

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
    temperature: 0.2,
    maxTokens: 3000,
    onToken: (tok) => {
      if (!firstTokenEmitted) {
        firstTokenEmitted = true;
        ttftMs = Date.now() - startedAt;
      }
      fullText += tok;
      options.onToken?.(tok);
    }
  });

  totalTokensIn += streamRes.tokensIn;
  totalTokensOut += streamRes.tokensOut;

  const latencyMs = Date.now() - startedAt;
  if (!ttftMs) ttftMs = latencyMs;

  const costUsd = calculateCost(totalTokensIn, totalTokensOut, searchCalls);

  const done: DoneEvent = {
    answerId,
    latencyMs,
    ttftMs,
    model: streamRes.model,
    tokens: { in: totalTokensIn, out: totalTokensOut },
    costUsd,
    searchCached: allSearchesCached && searchCalls > 0,
    terminated,
    depth: 'deep',
    subQuestions: planEvent.subQuestions.length
  };

  return {
    answerId,
    text: fullText,
    plan: planEvent,
    sources: mergedSources,
    traces,
    done,
    toolCallsLog,
    ttftMs,
    latencyMs
  };
}
