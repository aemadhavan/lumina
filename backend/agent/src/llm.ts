import { env, secrets } from './env.js';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamLLMOptions {
  systemPrompt?: string;
  messages: LLMMessage[];
  onToken?: (token: string) => void;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamLLMResult {
  fullText: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

/** Approximate token counter fallback if provider doesn't report exact usage */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.trim().split(/\s+/).length * 1.3);
}

export async function streamLLMCompletion(options: StreamLLMOptions): Promise<StreamLLMResult> {
  const provider = env.llmProvider;
  const model = env.llmModel;

  if (provider === 'gemini') {
    return streamGemini(options, model);
  } else if (provider === 'anthropic') {
    return streamAnthropic(options, model);
  } else if (provider === 'openai') {
    return streamOpenAI(options, model);
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

async function streamGemini(options: StreamLLMOptions, model: string): Promise<StreamLLMResult> {
  if (!secrets.gemini) {
    throw new Error('GEMINI_API_KEY is not set — required for Gemini LLM provider');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${secrets.gemini}`;

  const contents = options.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens ?? 2048
    }
  };

  const sys = options.systemPrompt || options.messages.find((m) => m.role === 'system')?.content;
  if (sys) {
    body.systemInstruction = { parts: [{ text: sys }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000)
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Gemini API upstream failure (${res.status}): ${errorText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let tokensIn = 0;
  let tokensOut = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr) {
          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            if (chunk) {
              fullText += chunk;
              options.onToken?.(chunk);
            }
            if (parsed.usageMetadata) {
              tokensIn = parsed.usageMetadata.promptTokenCount ?? tokensIn;
              tokensOut = parsed.usageMetadata.candidatesTokenCount ?? tokensOut;
            }
          } catch {
            // Ignore malformed intermediate chunks
          }
        }
      }
    }
  }

  if (buffer.trim().startsWith('data: ')) {
    try {
      const parsed = JSON.parse(buffer.trim().slice(6).trim());
      const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (chunk) {
        fullText += chunk;
        options.onToken?.(chunk);
      }
      if (parsed.usageMetadata) {
        tokensIn = parsed.usageMetadata.promptTokenCount ?? tokensIn;
        tokensOut = parsed.usageMetadata.candidatesTokenCount ?? tokensOut;
      }
    } catch {
      // Ignore
    }
  }

  if (tokensIn === 0) {
    const promptText = (sys ?? '') + options.messages.map((m) => m.content).join(' ');
    tokensIn = estimateTokens(promptText);
  }
  if (tokensOut === 0) {
    tokensOut = estimateTokens(fullText);
  }

  return { fullText, tokensIn, tokensOut, model };
}

async function streamAnthropic(options: StreamLLMOptions, model: string): Promise<StreamLLMResult> {
  if (!secrets.anthropic) {
    throw new Error('ANTHROPIC_API_KEY is not set — required for Anthropic LLM provider');
  }

  const url = 'https://api.anthropic.com/v1/messages';
  const sys = options.systemPrompt || options.messages.find((m) => m.role === 'system')?.content;
  const messages = options.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': secrets.anthropic,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      system: sys,
      messages,
      stream: true,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.2
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Anthropic API upstream failure (${res.status}): ${errorText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let tokensIn = 0;
  let tokensOut = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === 'content_block_delta') {
              const delta = parsed.delta?.text ?? '';
              fullText += delta;
              options.onToken?.(delta);
            } else if (parsed.type === 'message_start' && parsed.message?.usage) {
              tokensIn = parsed.message.usage.input_tokens ?? 0;
            } else if (parsed.type === 'message_delta' && parsed.usage) {
              tokensOut = parsed.usage.output_tokens ?? 0;
            }
          } catch {
            // Ignore
          }
        }
      }
    }
  }

  if (tokensIn === 0) tokensIn = estimateTokens(options.messages.map((m) => m.content).join(' '));
  if (tokensOut === 0) tokensOut = estimateTokens(fullText);

  return { fullText, tokensIn, tokensOut, model };
}

async function streamOpenAI(options: StreamLLMOptions, model: string): Promise<StreamLLMResult> {
  if (!secrets.openai) {
    throw new Error('OPENAI_API_KEY is not set — required for OpenAI LLM provider');
  }

  const url = 'https://api.openai.com/v1/chat/completions';
  const messages = [...options.messages];
  if (options.systemPrompt && !messages.some((m) => m.role === 'system')) {
    messages.unshift({ role: 'system', content: options.systemPrompt });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secrets.openai}`
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.2
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`OpenAI API upstream failure (${res.status}): ${errorText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let tokensIn = 0;
  let tokensOut = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              fullText += delta;
              options.onToken?.(delta);
            }
            if (parsed.usage) {
              tokensIn = parsed.usage.prompt_tokens ?? tokensIn;
              tokensOut = parsed.usage.completion_tokens ?? tokensOut;
            }
          } catch {
            // Ignore
          }
        }
      }
    }
  }

  if (tokensIn === 0) tokensIn = estimateTokens(options.messages.map((m) => m.content).join(' '));
  if (tokensOut === 0) tokensOut = estimateTokens(fullText);

  return { fullText, tokensIn, tokensOut, model };
}

export async function generateLLMCompletion(options: StreamLLMOptions): Promise<StreamLLMResult> {
  return streamLLMCompletion(options);
}
