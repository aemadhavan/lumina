import { Router, type Request, type Response } from 'express';
import { StatsResponse, USER_HEADER } from '@lumina/contract';
import { runsCollection, messagesCollection } from '../db.js';
import { getSearchCacheStats } from '../cache.js';
import { env } from '../env.js';

export const statsRouter = Router();

statsRouter.get('/stats', async (req: Request, res: Response) => {
  const userId = req.header(USER_HEADER);
  if (!userId || !userId.trim()) {
    res.status(401).json({ error: 'missing or empty x-user-id header', status: 401 });
    return;
  }

  const runs = await runsCollection();
  const messages = await messagesCollection();

  const totalRuns = await runs.countDocuments();
  const totalAnswers = await runs.countDocuments({ terminated: { $in: ['done', 'cap'] } });

  // TTFT p95 from messages collection
  const assistantMsgs = await messages
    .find({ role: 'assistant', 'done.ttftMs': { $exists: true } })
    .project({ 'done.ttftMs': 1 })
    .toArray();

  let ttftP95Ms = 0;
  if (assistantMsgs.length > 0) {
    const ttfts = assistantMsgs
      .map((m: any) => m.done?.ttftMs)
      .filter((t): t is number => typeof t === 'number' && !isNaN(t))
      .sort((a, b) => a - b);

    if (ttfts.length > 0) {
      const p95Idx = Math.floor(ttfts.length * 0.95);
      ttftP95Ms = ttfts[Math.min(p95Idx, ttfts.length - 1)] ?? 0;
    }
  }

  // Cost today
  const now = new Date();
  const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();

  const runsToday = await runs
    .find({ createdAt: { $gte: startOfTodayUtc } })
    .project({ costUsd: 1 })
    .toArray();

  const costUsdToday = Number(
    runsToday.reduce((sum, r: any) => sum + (r.costUsd || 0), 0).toFixed(4)
  );

  // Deep searches by this user today
  const deepToday = await runs.countDocuments({
    userId: userId.trim(),
    depth: 'deep',
    createdAt: { $gte: startOfTodayUtc }
  });

  const cacheStats = getSearchCacheStats();

  const stats: StatsResponse = {
    requests: totalRuns,
    answers: totalAnswers,
    searchCacheHitRatePct: cacheStats.hitRatePct,
    ttftP95Ms,
    costUsdToday,
    deepToday,
    deepDailyCap: env.deepDailyCap
  };

  StatsResponse.parse(stats);
  res.status(200).json(stats);
});
