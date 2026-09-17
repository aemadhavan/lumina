import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RunLog, type RunDoc, type ToolName, type Terminated, type Depth } from '@lumina/contract';
import { env } from './env.js';
import { runsCollection } from './db.js';

export interface WriteRunLogInput {
  requestId: string;
  userId?: string;
  threadId?: string;
  answerId?: string;
  query?: string;
  tokens: number;
  wallClockSec: number;
  costUsd: number;
  terminated: Terminated;
  depth?: Depth;
  toolCalls: Array<{ name: ToolName; ok: boolean; error?: string; ms?: number }>;
}

export async function writeRunLog(input: WriteRunLogInput): Promise<void> {
  const runData = {
    tokens: Math.max(0, Math.round(input.tokens)),
    wallClockSec: Math.max(0, Number(input.wallClockSec.toFixed(3))),
    costUsd: Math.max(0, Number(input.costUsd.toFixed(5))),
    terminated: input.terminated,
    depth: input.depth ?? 'quick',
    toolCalls: input.toolCalls.map((tc) => ({
      name: tc.name,
      ok: tc.ok,
      ...(tc.error ? { error: tc.error } : {}),
      ...(tc.ms !== undefined ? { ms: tc.ms } : {})
    }))
  };

  // Validate strictly against contract schema
  RunLog.parse(runData);

  // Ensure directories exist
  mkdirSync(env.runsDir, { recursive: true });
  mkdirSync(resolve(env.runsDir, 'failing'), { recursive: true });

  // AGENTS.md rule: keep failed/capped runs in runs/failing/, successful runs in runs/
  const targetDir = input.terminated !== 'done' ? resolve(env.runsDir, 'failing') : env.runsDir;
  const filePath = resolve(targetDir, `${input.requestId}.json`);
  writeFileSync(filePath, JSON.stringify(runData, null, 2), 'utf8');

  // Also persist to MongoDB runs collection for observability and stats reconciliation
  try {
    const col = await runsCollection();
    const runDoc: RunDoc = {
      ...runData,
      requestId: input.requestId,
      userId: input.userId,
      threadId: input.threadId,
      answerId: input.answerId,
      query: input.query,
      createdAt: new Date().toISOString()
    };
    await col.updateOne({ requestId: input.requestId }, { $set: runDoc }, { upsert: true });
  } catch (dbErr) {
    console.warn('Failed to persist run log to MongoDB:', dbErr);
  }
}
