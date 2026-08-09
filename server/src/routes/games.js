import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { recordGameResult, getPersonalBests, getChartPair, getBullBearRound } from '../lib/games.js';

const router = Router();

// Games themselves are playable by guests (same "browse freely, log in to
// save progress" pattern as the rest of the app) — only score-saving and
// personal bests require an account.
router.get('/chart-pair', async (_req, res) => {
  try {
    res.json(await getChartPair());
  } catch (err) {
    console.error('chart-pair error', err.message);
    res.status(502).json({ error: 'Could not load chart data right now.' });
  }
});

router.get('/bull-bear-round', async (_req, res) => {
  try {
    res.json(await getBullBearRound());
  } catch (err) {
    console.error('bull-bear-round error', err.message);
    res.status(502).json({ error: 'Could not load a headline right now.' });
  }
});

router.get('/results', optionalAuth, async (req, res) => {
  if (!req.userId) return res.json({ results: [] });
  try {
    res.json({ results: await getPersonalBests(req.userId) });
  } catch (err) {
    console.error('get game results error', err.message);
    res.status(500).json({ error: 'Could not load your game scores right now.' });
  }
});

router.post('/:gameId/result', requireAuth, async (req, res) => {
  try {
    const score = Number(req.body.score);
    if (!Number.isFinite(score)) return res.status(400).json({ error: 'Invalid score.' });
    await recordGameResult(req.userId, req.params.gameId, score, req.body.meta);
    res.json({ results: await getPersonalBests(req.userId) });
  } catch (err) {
    console.error('record game result error', err.message);
    res.status(500).json({ error: 'Could not save your score right now.' });
  }
});

export default router;
