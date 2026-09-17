import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import pino from 'pino';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { JobDoc, ChunkDoc, Locator } from '@lumina/contract';
import { env } from './env.js';
import {
  bucket,
  documentsCollection,
  jobsCollection,
  chunksCollection
} from './db.js';
import { getEmbeddings } from './embeddings.js';

const log = pino({ level: env.logLevel });

export async function readGridFsFile(fileId: string): Promise<Buffer> {
  const b = await bucket();
  const downloadStream = b.openDownloadStream(new ObjectId(fileId));
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    downloadStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    downloadStream.on('error', reject);
    downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPage[]> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages: ParsedPage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) {
      pages.push({ pageNumber: i, text: pageText });
    }
  }

  return pages;
}

export interface ParsedSection {
  heading?: string;
  line?: number;
  text: string;
}

export function parseMarkdown(text: string): ParsedSection[] {
  const lines = text.split(/\r?\n/);
  const sections: ParsedSection[] = [];
  let currentHeading = 'Overview';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      if (currentLines.length > 0) {
        sections.push({
          heading: currentHeading,
          text: currentLines.join('\n').trim()
        });
        currentLines = [];
      }
      currentHeading = headingMatch[1]?.trim() || 'Overview';
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      text: currentLines.join('\n').trim()
    });
  }

  return sections.filter((s) => s.text.length > 0);
}

export function parsePlainText(text: string): ParsedSection[] {
  const paragraphs = text.split(/\n\s*\n/);
  let lineNumber = 1;
  const sections: ParsedSection[] = [];

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (trimmed) {
      sections.push({
        line: lineNumber,
        text: trimmed
      });
    }
    lineNumber += p.split(/\r?\n/).length + 1;
  }

  return sections;
}

export function chunkPageText(text: string, pageNumber: number): Array<{ text: string; locator: Locator }> {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 1000) {
    return [{ text: clean, locator: { page: pageNumber } }];
  }

  // Split on sentence boundaries preserving 10-20% overlap
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) || [clean];
  const chunks: Array<{ text: string; locator: Locator }> = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > 900 && current.length >= 400) {
      chunks.push({ text: current.trim(), locator: { page: pageNumber } });
      // Keep last 150 chars for overlap
      const overlap = current.slice(-150);
      current = overlap + ' ' + sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }

  if (current.trim().length > 0) {
    chunks.push({ text: current.trim(), locator: { page: pageNumber } });
  }

  return chunks;
}

export function chunkSectionText(text: string, heading: string): Array<{ text: string; locator: Locator }> {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 1000) {
    return [{ text: clean, locator: { heading } }];
  }

  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) || [clean];
  const chunks: Array<{ text: string; locator: Locator }> = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > 900 && current.length >= 400) {
      chunks.push({ text: current.trim(), locator: { heading } });
      const overlap = current.slice(-150);
      current = overlap + ' ' + sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }

  if (current.trim().length > 0) {
    chunks.push({ text: current.trim(), locator: { heading } });
  }

  return chunks;
}

export async function claimNextJob(workerId: string): Promise<JobDoc | null> {
  const jobs = await jobsCollection();
  const res = await jobs.findOneAndUpdate(
    { status: 'pending' },
    {
      $set: {
        status: 'running',
        claimedAt: new Date().toISOString(),
        workerId
      },
      $inc: { attempts: 1 }
    },
    {
      sort: { createdAt: 1 },
      returnDocument: 'after'
    }
  );
  return (res as any) || null;
}

export async function sweepStaleJobs(staleMs = 120_000): Promise<number> {
  const jobs = await jobsCollection();
  const cutoff = new Date(Date.now() - staleMs).toISOString();
  const result = await jobs.updateMany(
    {
      status: 'running',
      claimedAt: { $lt: cutoff }
    },
    {
      $set: { status: 'pending', error: 'lease expired, returned to pending by sweeper' },
      $unset: { claimedAt: '', workerId: '' }
    }
  );
  return result.modifiedCount;
}

export async function probeReadYourWrite(
  spaceId: string,
  chunkId: string,
  embedding: number[],
  maxWaitMs = 30_000,
  intervalMs = 500
): Promise<boolean> {
  const col = await chunksCollection();
  const startedAt = Date.now();
  const pipeline = [
    {
      $vectorSearch: {
        index: 'chunks_vector',
        path: 'embedding',
        queryVector: embedding,
        numCandidates: 10,
        limit: 5,
        filter: {
          spaceId: { $eq: spaceId }
        }
      }
    },
    {
      $project: { _id: 1 }
    }
  ];

  while (Date.now() - startedAt < maxWaitMs) {
    try {
      const results = await col.aggregate(pipeline).toArray();
      const found = results.some((r) => String(r._id) === chunkId);
      if (found) {
        log.info({ chunkId, elapsedMs: Date.now() - startedAt }, 'read-your-write probe passed');
        return true;
      }
    } catch (err) {
      log.warn({ err, chunkId }, 'read-your-write probe attempt failed, retrying');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return false;
}

export async function processJob(job: JobDoc): Promise<void> {
  const docId = job.payload.docId as string;
  const spaceId = job.payload.spaceId as string;
  const fileId = job.payload.fileId as string;
  const filename = (job.payload.filename as string) || 'document';
  const userId = job.userId;

  const docs = await documentsCollection();
  const jobs = await jobsCollection();
  const chunksCol = await chunksCollection();

  log.info({ docId, spaceId, filename }, 'worker: beginning document ingestion');

  try {
    // 1. Mark parsing
    await docs.updateOne(
      { _id: docId as any },
      { $set: { status: 'parsing', pct: 10 } }
    );

    // 2. Read from GridFS
    const buffer = await readGridFsFile(fileId);

    // 3. Parse into chunks with locators
    const rawChunks: Array<{ text: string; locator: Locator }> = [];
    let pageCount = 1;

    if (filename.toLowerCase().endsWith('.pdf')) {
      const parsedPages = await parsePdf(buffer);
      pageCount = parsedPages.length;
      for (const p of parsedPages) {
        const pageChunks = chunkPageText(p.text, p.pageNumber);
        rawChunks.push(...pageChunks);
      }
    } else if (filename.toLowerCase().endsWith('.md') || filename.toLowerCase().endsWith('.markdown')) {
      const text = buffer.toString('utf-8');
      const sections = parseMarkdown(text);
      for (const s of sections) {
        const sectionChunks = chunkSectionText(s.text, s.heading || 'Overview');
        rawChunks.push(...sectionChunks);
      }
    } else {
      const text = buffer.toString('utf-8');
      const sections = parsePlainText(text);
      for (const s of sections) {
        rawChunks.push({
          text: s.text,
          locator: { line: s.line || 1 }
        });
      }
    }

    // 4. Mark embedding
    await docs.updateOne(
      { _id: docId as any },
      { $set: { status: 'embedding', pct: 30, pages: pageCount } }
    );

    // 5. Batch embed chunks
    const BATCH_SIZE = 16;
    const chunkDocs: ChunkDoc[] = [];

    for (let i = 0; i < rawChunks.length; i += BATCH_SIZE) {
      const batch = rawChunks.slice(i, i + BATCH_SIZE);
      const embeddings = await getEmbeddings(batch.map((b) => b.text));

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const emb = embeddings[j];
        if (!item || !emb) continue;
        const ord = i + j;
        const chunkId = `chk_${docId}_${ord}`;
        chunkDocs.push({
          _id: chunkId,
          docId: docId as any,
          spaceId: spaceId as any,
          userId: userId as any,
          text: item.text,
          locator: item.locator,
          ord,
          embedding: emb,
          createdAt: new Date().toISOString()
        });
      }

      const progress = 30 + Math.round(((i + batch.length) / rawChunks.length) * 50);
      await docs.updateOne({ _id: docId as any }, { $set: { pct: progress } });
    }

    // 6. Upsert into chunks collection
    if (chunkDocs.length > 0) {
      await chunksCol.deleteMany({ docId: docId as any });
      await chunksCol.insertMany(chunkDocs);
    }

    // 7. Read-Your-Write Probe (Task 5.4)
    if (chunkDocs.length > 0) {
      const targetChunk = chunkDocs[0]!;
      log.info({ docId, chunkId: targetChunk._id }, 'worker: executing read-your-write probe on vector index');
      const probePassed = await probeReadYourWrite(spaceId, targetChunk._id, targetChunk.embedding);

      if (!probePassed) {
        throw new Error(`read-your-write probe timed out: chunk ${targetChunk._id} not searchable in chunks_vector within SLA`);
      }
    }

    // 8. Update document records to indexed
    await docs.updateOne(
      { _id: docId as any },
      {
        $set: {
          status: 'indexed',
          chunks: chunkDocs.length,
          pct: 100
        }
      }
    );

    // Complete job
    await jobs.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'done',
          updatedAt: new Date().toISOString()
        }
      }
    );

    log.info({ docId, chunks: chunkDocs.length, pages: pageCount }, 'worker: document successfully indexed');
  } catch (err) {
    const errorMsg = (err as Error).message || 'Processing failed';
    log.error({ err, docId }, 'worker: failed document processing');
    await docs.updateOne(
      { _id: docId as any },
      { $set: { status: 'failed', error: errorMsg } }
    );
    await jobs.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'failed',
          error: errorMsg,
          updatedAt: new Date().toISOString()
        }
      }
    );
    throw err;
  }
}

export async function runWorkerLoop(): Promise<void> {
  const workerId = `worker_${randomUUID().slice(0, 8)}`;
  log.info({ workerId }, 'worker daemon started');

  while (true) {
    try {
      await sweepStaleJobs();
      const job = await claimNextJob(workerId);
      if (job) {
        await processJob(job);
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      log.error({ err }, 'worker loop error');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const isEntrypoint = () => {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
  } catch {
    return false;
  }
};

if (isEntrypoint()) {
  void runWorkerLoop();
}
