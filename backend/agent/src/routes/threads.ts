import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  AskBody,
  CreateThreadBody,
  type CreateThreadResponse,
  type GetThreadResponse,
  type ListThreadsResponse,
  newId,
  USER_HEADER,
  REQUEST_HEADER
} from '@lumina/contract';
import { threadsCollection, messagesCollection, runsCollection } from '../db.js';
import { runQuickLoop } from '../loop.js';
import { runDeepLoop } from '../deep_loop.js';
import { writeRunLog } from '../runs.js';
import { env } from '../env.js';

export const threadsRouter = Router();

function getUserId(req: Request, res: Response): string | null {
  const userId = req.header(USER_HEADER);
  if (!userId || !userId.trim()) {
    res.status(401).json({ error: 'missing or empty x-user-id header', status: 401 });
    return null;
  }
  return userId.trim();
}

function getRequestId(req: Request): string {
  return (req.header(REQUEST_HEADER) || randomUUID()) as string;
}

// ---------------------------------------------------------------- POST /threads
threadsRouter.post('/threads', async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const parsed = CreateThreadBody.safeParse(req.body ?? {});
  const title = (parsed.success && parsed.data.title) ? parsed.data.title : 'New Search';
  const threadId = newId('thr');

  const threads = await threadsCollection();
  await threads.insertOne({
    _id: threadId,
    userId,
    title,
    createdAt: new Date().toISOString()
  });

  const response: CreateThreadResponse = { threadId };
  res.status(200).json(response);
});

// ---------------------------------------------------------------- GET /threads
threadsRouter.get('/threads', async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const threads = await threadsCollection();
  const docs = await threads.find({ userId }).sort({ createdAt: -1 }).toArray();

  const response: ListThreadsResponse = {
    threads: docs.map((d) => ({
      threadId: d._id,
      title: d.title,
      createdAt: typeof d.createdAt === 'string' ? d.createdAt : d.createdAt.toISOString()
    }))
  };

  res.status(200).json(response);
});

// ---------------------------------------------------------------- GET /threads/:threadId
threadsRouter.get('/threads/:threadId', async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const threadId = req.params.threadId as string;
  const threads = await threadsCollection();
  const thread = await threads.findOne({ _id: threadId, userId });

  if (!thread) {
    res.status(404).json({ error: `thread not found: ${threadId}`, status: 404 });
    return;
  }

  const messages = await messagesCollection();
  const msgDocs = await messages.find({ threadId, userId }).sort({ createdAt: 1 }).toArray();

  const response: GetThreadResponse = {
    threadId: thread._id,
    title: thread.title,
    messages: msgDocs.map((m) => ({
      role: m.role,
      content: m.content,
      sources: m.sources,
      answerId: m.answerId,
      done: m.done,
      createdAt: typeof m.createdAt === 'string' ? m.createdAt : m.createdAt.toISOString()
    }))
  };

  res.status(200).json(response);
});

// ---------------------------------------------------------------- DELETE /threads/:threadId
threadsRouter.delete('/threads/:threadId', async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const threadId = req.params.threadId as string;
  const threads = await threadsCollection();
  const result = await threads.deleteOne({ _id: threadId, userId });

  if (result.deletedCount === 0) {
    res.status(404).json({ error: `thread not found: ${threadId}`, status: 404 });
    return;
  }

  const messages = await messagesCollection();
  await messages.deleteMany({ threadId, userId });

  res.status(200).json({ ok: true });
});

// ---------------------------------------------------------------- GET /threads/:threadId/messages
threadsRouter.get('/threads/:threadId/messages', async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const threadId = req.params.threadId as string;
  const threads = await threadsCollection();
  const thread = await threads.findOne({ _id: threadId, userId });

  if (!thread) {
    res.status(404).json({ error: `thread not found: ${threadId}`, status: 404 });
    return;
  }

  const messages = await messagesCollection();
  const msgDocs = await messages.find({ threadId, userId }).sort({ createdAt: 1 }).toArray();

  res.status(200).json({
    messages: msgDocs.map((m) => ({
      role: m.role,
      content: m.content,
      sources: m.sources,
      answerId: m.answerId,
      done: m.done,
      createdAt: typeof m.createdAt === 'string' ? m.createdAt : m.createdAt.toISOString()
    }))
  });
});

// ---------------------------------------------------------------- POST /threads/:threadId/ask (Streaming SSE)
threadsRouter.post('/threads/:threadId/ask', async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const threadId = req.params.threadId as string;
  const requestId = getRequestId(req);
  res.setHeader(REQUEST_HEADER, requestId);

  // Validate body
  const parsedBody = AskBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      error: `Invalid ask body: ${parsedBody.error.issues.map((i) => i.message).join(', ')}`,
      status: 400
    });
    return;
  }

  const { query, mode, depth, spaceId } = parsedBody.data;
  const requestedDepth = depth ?? 'quick';

  const [threads, messages] = await Promise.all([
    threadsCollection(),
    messagesCollection()
  ]);

  // 404 / 429 before SSE. Do not load the full transcript until headers are flushed.
  const thread = await threads.findOne({ _id: threadId, userId }, { projection: { _id: 1 } });
  if (!thread) {
    res.status(404).json({ error: `thread not found: ${threadId}`, status: 404 });
    return;
  }

  if (requestedDepth === 'deep') {
    const runs = await runsCollection();
    const now = new Date();
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
    const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)).toISOString();

    const deepCountToday = await runs.countDocuments({
      userId,
      depth: 'deep',
      createdAt: { $gte: startOfTodayUtc }
    });

    if (deepCountToday >= env.deepDailyCap) {
      res.status(429).json({
        error: `Daily deep search limit reached (${env.deepDailyCap}/${env.deepDailyCap})`,
        status: 429,
        resetsAt,
        requestId
      });
      return;
    }
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');
  res.flushHeaders?.();
  try {
    res.socket?.setNoDelay(true);
  } catch {
    // ignore
  }
  res.write(`:${' '.repeat(2048)}\n\n`);

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  };

  const priorDocs = await messages.find({ threadId, userId }).sort({ createdAt: -1 }).limit(4).toArray();
  priorDocs.reverse();
  const history = priorDocs.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content.length > 500 ? `${m.content.slice(0, 500)}...` : m.content
  }));

  // Persist user turn concurrently in background without blocking TTFT
  const userMsgId = randomUUID();
  const userInsertPromise = messages.insertOne({
    _id: userMsgId,
    threadId,
    userId,
    role: 'user',
    content: query,
    sources: [],
    createdAt: new Date().toISOString()
  });

  try {
    let result;
    if (requestedDepth === 'deep') {
      result = await runDeepLoop({
        query,
        mode,
        spaceId,
        threadId,
        userId,
        history,
        onPlan: (p) => send('plan', p),
        onTrace: (t) => send('trace', t),
        onSources: (s) => send('sources', s),
        onToken: (tok) => send('token', { text: tok })
      });
    } else {
      result = await runQuickLoop({
        query,
        mode,
        depth: 'quick',
        spaceId,
        threadId,
        userId,
        history,
        onTrace: (t) => send('trace', t),
        onSources: (s) => send('sources', s),
        onToken: (tok) => send('token', { text: tok })
      });
    }

    send('done', result.done);
    res.end();

    // Await user turn insertion before persisting assistant message
    await userInsertPromise;

    // Persist assistant message
    const assistantMsgId = randomUUID();
    await messages.insertOne({
      _id: assistantMsgId,
      threadId,
      userId,
      role: 'assistant',
      content: result.text,
      answerId: result.answerId,
      sources: result.sources,
      done: result.done,
      createdAt: new Date().toISOString()
    });

    // Write run log
    await writeRunLog({
      requestId,
      userId,
      threadId,
      answerId: result.answerId,
      query,
      tokens: result.done.tokens.in + result.done.tokens.out,
      wallClockSec: Number((result.latencyMs / 1000).toFixed(3)),
      costUsd: result.done.costUsd,
      terminated: result.done.terminated,
      depth: result.done.depth,
      toolCalls: result.toolCallsLog
    });
  } catch (err) {
    console.error('[Ask execution error]:', err);
    const errMsg = (err as Error).message || 'Upstream execution failure';
    send('error', { error: errMsg, status: 502 });
    res.end();

    await writeRunLog({
      requestId,
      userId,
      threadId,
      query,
      tokens: 0,
      wallClockSec: 0,
      costUsd: 0,
      terminated: 'error',
      depth: requestedDepth,
      toolCalls: []
    });
  }
});
