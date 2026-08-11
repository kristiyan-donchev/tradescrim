import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import {
  getPortfolio,
  buyShares,
  sellShares,
  resetPortfolio,
  getPerformance,
  getLeaderboard,
  getMostActiveLeaderboard,
  getBiggestWinLeaderboard,
  getDiversificationLeaderboard,
} from '../lib/portfolio.js';
import { getFriendIds } from '../lib/friends.js';
import { getQuote } from '../lib/quotes.js';

const router = Router();

const PERFORMANCE_RANGES = ['1d', '1w', '1mo', '3mo', '6mo', '1y', 'all'];
const LEADERBOARD_CATEGORIES = ['return', 'active', 'biggest_win', 'diversified'];

// Public — the leaderboard is meant to be browsable without an account.
// Registered before router.use(requireAuth) below so guests reach it.
router.get('/leaderboard', optionalAuth, async (req, res) => {
  const range = PERFORMANCE_RANGES.includes(req.query.range) ? req.query.range : '1mo';
  const category = LEADERBOARD_CATEGORIES.includes(req.query.category) ? req.query.category : 'return';
  try {
    let userIds = null;
    if (req.query.scope === 'friends') {
      if (!req.userId) return res.status(401).json({ error: 'Log in to see your friends leaderboard.' });
      userIds = [...(await getFriendIds(req.userId)), req.userId];
    }
    if (category === 'active') return res.json(await getMostActiveLeaderboard(range, { userIds }));
    if (category === 'biggest_win') return res.json(await getBiggestWinLeaderboard(range, { userIds }));
    if (category === 'diversified') return res.json(await getDiversificationLeaderboard({ userIds }));
    res.json({ ...(await getLeaderboard(range, { userIds })), category: 'return' });
  } catch (err) {
    console.error('leaderboard error', err.message);
    res.status(502).json({ error: 'Could not load the leaderboard right now.' });
  }
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    res.json(await getPortfolio(req.userId));
  } catch (err) {
    console.error('get portfolio error', err.message);
    res.status(500).json({ error: 'Could not load your portfolio right now.' });
  }
});

router.get('/performance', async (req, res) => {
  const range = PERFORMANCE_RANGES.includes(req.query.range) ? req.query.range : '1mo';
  try {
    res.json(await getPerformance(req.userId, range));
  } catch (err) {
    console.error('performance error', err.message);
    res.status(502).json({ error: 'Could not load portfolio performance right now.' });
  }
});

// Market orders fill at whatever price the server itself fetches right now —
// the client's `price` is never trusted for this. It used to be (whatever
// the client's last-displayed quote happened to be, sent straight through to
// buyShares/sellShares), which meant anyone could edit the request in
// devtools and buy or sell at any price they wanted, fabricating unlimited
// profit and topping the leaderboard/achievements on fake gains.
router.post('/buy', async (req, res) => {
  const { symbol, name, shares } = req.body || {};
  try {
    const quote = await getQuote(symbol);
    const portfolio = await buyShares(req.userId, {
      symbol,
      name: name || quote.name,
      shares: Number(shares),
      price: quote.price,
    });
    res.json(portfolio);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/sell', async (req, res) => {
  const { symbol, name, shares } = req.body || {};
  try {
    const quote = await getQuote(symbol);
    const portfolio = await sellShares(req.userId, {
      symbol,
      name: name || quote.name,
      shares: Number(shares),
      price: quote.price,
    });
    res.json(portfolio);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/reset', async (req, res) => {
  try {
    res.json(await resetPortfolio(req.userId));
  } catch (err) {
    console.error('reset portfolio error', err.message);
    res.status(500).json({ error: 'Could not reset your portfolio right now.' });
  }
});

export default router;
