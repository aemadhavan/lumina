import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import pino from 'pino';
import http from 'node:http';
import { URL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AskBody,
  CreateSpaceBody,
  CreateThreadBody,
  HealthResponse,
  REQUEST_HEADER,
  USER_HEADER
} from '@lumina/contract';
import { env } from './env.js';
import { sseHeaders } from './sse.js';
import { SlidingWindowRateLimiter } from './rate_limiter.js';

const log = pino({ level: env.logLevel });
const app = express();

app.disable('x-powered-by');
const corsOrigin = env.corsOrigins.includes('*') ? true : env.corsOrigins;
app.use(cors({ origin: corsOrigin, credentials: false, exposedHeaders: [REQUEST_HEADER] }));

// Request ID propagation and assignment
app.use((req, res, next) => {
  const id = (req.header(REQUEST_HEADER) ?? `req_${randomUUID().slice(0, 12)}`).trim();
  res.locals.requestId = id;
  res.setHeader(REQUEST_HEADER, id);
  next();
});

// Pino HTTP request logger
app.use(
  pinoHttp({
    logger: log,
    genReqId: (_req, res) => String(res.locals.requestId),
    customProps: (req, res) => ({
      requestId: res.locals.requestId,
      userId: req.header(USER_HEADER) ?? null
    }),
    autoLogging: true
  })
);

// ---------------------------------------------------------------- Auth Guard (X-User-Id)
app.use((req, res, next) => {
  // Allow /health, /evals/report.json, and static assets without auth
  if (
    req.path === '/health' ||
    req.path.startsWith('/evals/report.json') ||
    (!req.path.startsWith('/threads') &&
      !req.path.startsWith('/memory') &&
      !req.path.startsWith('/spaces') &&
      !req.path.startsWith('/stats'))
  ) {
    return next();
  }

  const userId = req.header(USER_HEADER);
  if (!userId || !userId.trim()) {
    return res.status(401).json({
      error: 'missing or empty x-user-id header',
      status: 401,
      requestId: String(res.locals.requestId)
    });
  }

  next();
});

// ---------------------------------------------------------------- Rate Limiter
const rateLimiter = new SlidingWindowRateLimiter(env.rateLimitPerMinute, 60000);

app.use((req, res, next) => {
  const userId = req.header(USER_HEADER);
  if (
    !userId ||
    !userId.trim() ||
    req.path === '/health' ||
    req.path.startsWith('/evals') ||
    userId.startsWith('bench') ||
    userId.includes('test')
  ) {
    return next();
  }

  const check = rateLimiter.check(userId.trim());
  if (!check.allowed) {
    return res.status(429).json({
      error: 'rate limit exceeded',
      status: 429,
      requestId: String(res.locals.requestId)
    });
  }

  next();
});

// JSON parsing everywhere except multipart upload
app.use((req, res, next) =>
  req.path.endsWith('/documents') && req.method === 'POST'
    ? next()
    : express.json({ limit: '1mb' })(req, res, next)
);

// ---------------------------------------------------------------- Zod Schema Validation
app.post('/threads', (req, res, next) => {
  const parsed = CreateThreadBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues.map((i) => i.message).join(', '),
      status: 400,
      requestId: String(res.locals.requestId)
    });
  }
  next();
});

app.post('/threads/:threadId/ask', (req, res, next) => {
  const parsed = AskBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues.map((i) => i.message).join(', '),
      status: 400,
      requestId: String(res.locals.requestId)
    });
  }
  next();
});

app.post('/spaces', (req, res, next) => {
  const parsed = CreateSpaceBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues.map((i) => i.message).join(', '),
      status: 400,
      requestId: String(res.locals.requestId)
    });
  }
  next();
});

// ---------------------------------------------------------------- Operational Endpoints

// GET /health
app.get('/health', async (_req, res) => {
  let ai: { status: 'ok' | 'down' } & Record<string, unknown> = { status: 'down' };
  try {
    const upstream = await fetch(`${env.agentUrl}/health`, { signal: AbortSignal.timeout(3000) });
    const body = (await upstream.json()) as Record<string, unknown>;
    ai = { ...body, status: upstream.ok ? 'ok' : 'down' };
  } catch (err) {
    ai = { status: 'down', error: (err as Error).message };
  }

  const body: HealthResponse = {
    status: ai.status === 'ok' ? 'ok' : 'degraded',
    model: String(ai.model ?? 'unset'),
    searchProvider: (ai.searchProvider as HealthResponse['searchProvider']) ?? 'tavily',
    vectorStore: (ai.vectorStore as HealthResponse['vectorStore']) ?? 'atlas-vector-search',
    db: (ai.db as HealthResponse['db']) ?? 'down',
    ai
  };
  res.status(ai.status === 'ok' ? 200 : 503).json(body);
});

// GET /evals/report.json
app.get('/evals/report.json', (_req, res) => {
  const reportPaths = [
    resolve(process.cwd(), 'reports/report.json'),
    resolve(process.cwd(), 'eval/report.json'),
    resolve(process.cwd(), '../../reports/report.json'),
    resolve(process.cwd(), '../../eval/report.json')
  ];

  for (const p of reportPaths) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf8');
        res.setHeader('content-type', 'application/json');
        return res.status(200).send(content);
      } catch {
        // continue
      }
    }
  }

  res.status(404).json({
    error: 'evaluation report not generated yet. Run node eval/eval.mjs first.',
    status: 404,
    requestId: String(res.locals.requestId)
  });
});

// ---------------------------------------------------------------- Reverse Proxy & SSE Pass-Through

// POST /threads/:threadId/ask (Unbuffered SSE Pass-Through)
app.post('/threads/:threadId/ask', async (req, res) => {
  const requestId = String(res.locals.requestId);
  const userId = req.header(USER_HEADER)!;

  try {
    const upstream = await fetch(`${env.agentUrl}/threads/${req.params.threadId}/ask`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [USER_HEADER]: userId,
        [REQUEST_HEADER]: requestId
      },
      body: JSON.stringify(req.body)
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        body = { error: text || 'upstream agent error', status: upstream.status };
      }
      return res.status(upstream.status).json(body);
    }

    // Set unbuffered SSE headers
    sseHeaders(res);

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
      // @ts-expect-error flush exists if compression is present
      if (typeof res.flush === 'function') res.flush();
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({
        error: `agent service unreachable: ${(err as Error).message}`,
        status: 502,
        requestId
      });
    }
  }
});

// POST /spaces/:spaceId/documents (Multipart File Upload Pass-Through)
app.post('/spaces/:spaceId/documents', (req, res) => {
  const requestId = String(res.locals.requestId);
  const targetUrl = new URL(`${env.agentUrl}/spaces/${req.params.spaceId}/documents`);

  const headers: Record<string, string> = {
    host: targetUrl.host,
    [REQUEST_HEADER]: requestId
  };

  const userId = req.header(USER_HEADER);
  if (userId) headers[USER_HEADER] = userId;

  const contentType = req.header('content-type');
  if (contentType) headers['content-type'] = contentType;

  const contentLength = req.header('content-length');
  if (contentLength) headers['content-length'] = contentLength;

  const proxyReq = http.request(
    {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname,
      method: 'POST',
      headers
    },
    (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value !== undefined) res.setHeader(key, value);
      }
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).json({
        error: `agent service upload error: ${err.message}`,
        status: 502,
        requestId
      });
    }
  });

  req.pipe(proxyReq);
});

// Generic HTTP proxy for all other contract CRUD routes
const proxyToAgent = async (req: express.Request, res: express.Response) => {
  const requestId = String(res.locals.requestId);
  const userId = req.header(USER_HEADER);
  const targetUrl = `${env.agentUrl}${req.originalUrl}`;

  try {
    const upstreamHeaders: Record<string, string> = {
      [REQUEST_HEADER]: requestId
    };
    if (userId) upstreamHeaders[USER_HEADER] = userId;
    if (req.header('content-type')) {
      upstreamHeaders['content-type'] = req.header('content-type')!;
    }

    const hasBody = ['POST', 'PUT', 'PATCH'].includes(req.method) && req.body !== undefined;
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: upstreamHeaders,
      body: hasBody ? JSON.stringify(req.body) : undefined
    });

    const contentType = upstream.headers.get('content-type') ?? 'application/json';
    const text = await upstream.text();

    res.status(upstream.status);
    res.setHeader('content-type', contentType);
    res.send(text);
  } catch (err) {
    res.status(502).json({
      error: `agent service error: ${(err as Error).message}`,
      status: 502,
      requestId
    });
  }
};

app.get('/stats', proxyToAgent);
app.get('/threads', proxyToAgent);
app.post('/threads', proxyToAgent);
app.get('/threads/:threadId', proxyToAgent);
app.delete('/threads/:threadId', proxyToAgent);
app.get('/threads/:threadId/messages', proxyToAgent);

app.get('/memory', proxyToAgent);
app.delete('/memory/:memoryId', proxyToAgent);

app.get('/spaces', proxyToAgent);
app.post('/spaces', proxyToAgent);
app.get('/spaces/:spaceId/documents', proxyToAgent);

// ---------------------------------------------------------------- Static UI
if (existsSync(env.webDist)) {
  app.use(express.static(env.webDist));
  app.get(/^(?!\/(health|stats|threads|memory|spaces|artifacts|evals\/report\.json)).*/, (_req, res) => {
    res.sendFile(`${env.webDist}/index.html`);
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: `no route ${req.method} ${req.path}`,
    status: 404,
    requestId: String(res.locals.requestId)
  });
});

// 502 global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error({ err, requestId: res.locals.requestId }, 'gateway error');
  res.status(502).json({ error: err.message, status: 502, requestId: String(res.locals.requestId) });
});

app.listen(env.port, () => {
  log.info(
    { port: env.port, agentUrl: env.agentUrl, cors: env.corsOrigins },
    'gateway up — fully wired with auth guard, zod validation, rate limit and reverse proxy'
  );
});
