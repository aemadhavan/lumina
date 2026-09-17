#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

console.log('[LUMINA] Starting production services: Agent, Worker, Gateway...');

const agent = spawn(process.execPath, [join(ROOT, 'backend/agent/dist/index.js')], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, PORT_AGENT: '8000', PORT: '8000' }
});

agent.on('exit', (code) => {
  console.error(`[LUMINA] Agent service exited with code ${code}`);
});

const worker = spawn(process.execPath, [join(ROOT, 'backend/agent/dist/worker.js')], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env }
});

worker.on('exit', (code) => {
  console.error(`[LUMINA] Background worker exited with code ${code}`);
});

// Allow agent service 1.5s to initialize database and HTTP port before gateway starts
setTimeout(() => {
  const gateway = spawn(process.execPath, [join(ROOT, 'backend/gateway/dist/index.js')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, AGENT_URL: process.env.AGENT_URL ?? 'http://localhost:8000' }
  });

  gateway.on('exit', (code) => {
    console.error(`[LUMINA] Gateway exited with code ${code}`);
    process.exit(code ?? 1);
  });
}, 1500);

const shutdown = () => {
  console.log('[LUMINA] Shutting down services gracefully...');
  agent.kill();
  worker.kill();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
