import { PlanEvent, type SubQuestion } from '@lumina/contract';
import { streamLLMCompletion, type LLMMessage } from '../llm.js';

export interface PlanResearchInput {
  query: string;
}

export interface PlanResearchResult {
  plan: PlanEvent;
  tokensIn: number;
  tokensOut: number;
}

/**
 * Decomposes a research query into 3 to 6 logical sub-questions with accompanying rationales.
 * This tool is strictly for Deep Search runs and must be emitted as a plan SSE event before any retrieval.
 */
export async function planResearch(input: PlanResearchInput): Promise<PlanResearchResult> {
  const systemPrompt = `You are an expert research planner in LUMINA, a precision AI search engine.
Your task is to decompose a complex user query into 3 to 6 logical, distinct sub-questions that together cover all facets required to answer the query comprehensively.
Rules:
1. Generate between 3 and 6 sub-questions.
2. Each sub-question must be specific, searchable, and non-overlapping.
3. For each sub-question, provide a clear, concise one-line reason explaining why this question is necessary.
4. Output STRICTLY a JSON object with this format (no markdown fences, no preamble):
{
  "reason": "Overall strategy for researching this topic",
  "subQuestions": [
    { "i": 1, "question": "Sub-question 1", "reason": "Why sub-question 1 is needed" },
    { "i": 2, "question": "Sub-question 2", "reason": "Why sub-question 2 is needed" },
    { "i": 3, "question": "Sub-question 3", "reason": "Why sub-question 3 is needed" }
  ]
}`;

  const userPrompt = `Decompose this research query into 3 to 6 sub-questions:
"${input.query}"`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const res = await streamLLMCompletion({
    messages,
    systemPrompt,
    temperature: 0.2,
    maxTokens: 400
  });

  let rawJson = res.fullText.trim();
  // Strip markdown code fences if present
  if (rawJson.startsWith('```')) {
    rawJson = rawJson.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    const match = rawJson.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error(`Failed to parse research plan JSON: ${(err as Error).message}`);
    }
  }

  // Validate with PlanEvent schema
  const validated = PlanEvent.safeParse(parsed);
  if (!validated.success) {
    const data = parsed as any;
    if (Array.isArray(data?.subQuestions) && data.subQuestions.length >= 2) {
      const normalizedSubs: SubQuestion[] = data.subQuestions.slice(0, 6).map((sq: any, idx: number) => ({
        i: idx + 1,
        question: String(sq.question || sq.q || sq).trim(),
        reason: sq.reason ? String(sq.reason).trim() : undefined
      }));
      const fallbackPlan: PlanEvent = {
        reason: data.reason ? String(data.reason).trim() : undefined,
        subQuestions: normalizedSubs
      };
      return {
        plan: PlanEvent.parse(fallbackPlan),
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut
      };
    }
    throw new Error(`Invalid plan_research structure: ${validated.error.message}`);
  }

  return {
    plan: validated.data,
    tokensIn: res.tokensIn,
    tokensOut: res.tokensOut
  };
}
