import { Router, type Request, type Response } from 'express';
import {
  USER_HEADER,
  ListMemoryResponse
} from '@lumina/contract';
import { memoriesCollection } from '../db.js';
import { invalidateUserMemoryCache } from '../tools/memory.js';

export const memoryRouter = Router();

function getUserId(req: Request, res: Response): string | null {
  const userId = req.header(USER_HEADER);
  if (!userId || !userId.trim()) {
    res.status(401).json({ error: 'missing or empty x-user-id header', status: 401 });
    return null;
  }
  return userId.trim();
}

// ---------------------------------------------------------------- GET /memory
memoryRouter.get('/memory', async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const memories = await memoriesCollection();
  const docs = await memories.find({ userId }).sort({ createdAt: -1 }).toArray();

  const response: ListMemoryResponse = {
    memories: docs.map((d) => ({
      id: d._id as any,
      text: d.text,
      sourceThread: d.sourceThread as any,
      createdAt: typeof d.createdAt === 'string' ? d.createdAt : (d.createdAt as Date).toISOString()
    }))
  };

  // Validate contract schema compliance
  ListMemoryResponse.parse(response);

  res.status(200).json(response);
});

// ---------------------------------------------------------------- DELETE /memory/:memoryId
memoryRouter.delete('/memory/:memoryId', async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const { memoryId } = req.params;
  const memories = await memoriesCollection();
  const result = await memories.deleteOne({ _id: memoryId, userId });

  if (result.deletedCount === 0) {
    res.status(404).json({ error: `memory ${memoryId} not found`, status: 404 });
    return;
  }

  invalidateUserMemoryCache(userId);
  res.status(204).end();
});
