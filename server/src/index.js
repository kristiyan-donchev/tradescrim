import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import marketRouter from './routes/market.js';
import authRouter from './routes/auth.js';
import portfolioRouter from './routes/portfolio.js';
import watchlistRouter from './routes/watchlist.js';
import alertsRouter from './routes/alerts.js';
import ordersRouter from './routes/orders.js';
import achievementsRouter from './routes/achievements.js';
import friendsRouter from './routes/friends.js';
import challengesRouter from './routes/challenges.js';
import bugReportsRouter from './routes/bugReports.js';
import lessonsRouter from './routes/lessons.js';
import gamesRouter from './routes/games.js';
import { initSchema } from './db.js';
import { getPrices } from './lib/quotes.js';
import { getActiveAlertSymbols, processAlerts } from './lib/alerts.js';
import { getPendingOrderSymbols, processOrders } from './lib/orders.js';
import { getChallengesDueForFinalization, finalizeChallenge } from './lib/challenges.js';

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:4173').split(',');

app.use(cors({ origin: CLIENT_ORIGINS, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api', marketRouter);
app.use('/api/auth', authRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/achievements', achievementsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/challenges', challengesRouter);
app.use('/api/bugs', bugReportsRouter);
app.use('/api/lessons', lessonsRouter);
app.use('/api/games', gamesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Periodically checks active price alerts and pending limit/stop/stop-limit
// orders against live prices. Both need "current price for a set of symbols",
// so they share one batched fetch here rather than each hitting Yahoo
// separately — keeps this well clear of Yahoo's rate limits even as the
// number of open alerts/orders grows.
const MARKET_CHECK_INTERVAL_MS = 2 * 60 * 1000;

async function runMarketChecks() {
  try {
    const [alertSymbols, orderSymbols] = await Promise.all([getActiveAlertSymbols(), getPendingOrderSymbols()]);
    const symbols = [...new Set([...alertSymbols, ...orderSymbols])];
    if (symbols.length === 0) return;
    const priceMap = await getPrices(symbols);
    await Promise.all([processAlerts(priceMap), processOrders(priceMap)]);
  } catch (err) {
    console.error('Market check failed:', err.message);
  }
}

function scheduleMarketChecks() {
  runMarketChecks();
  setInterval(runMarketChecks, MARKET_CHECK_INTERVAL_MS);
}

// Challenge standings are computed once and locked in at ends_at, since
// trading continues afterward and a live recompute would keep shifting who
// "won" — this periodically finalizes any that have ended but not yet been
// scored. Not price-sensitive like market checks, so a coarser interval is
// fine; standings routes also finalize lazily on read to close the gap
// before this next runs.
const CHALLENGE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function runChallengeChecks() {
  try {
    const dueIds = await getChallengesDueForFinalization();
    for (const id of dueIds) await finalizeChallenge(id);
  } catch (err) {
    console.error('Challenge finalization failed:', err.message);
  }
}

function scheduleChallengeChecks() {
  runChallengeChecks();
  setInterval(runChallengeChecks, CHALLENGE_CHECK_INTERVAL_MS);
}

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`TradeScrim server listening on http://localhost:${PORT}`);
    });
    scheduleMarketChecks();
    scheduleChallengeChecks();
  })
  .catch((err) => {
    console.error('Failed to initialize the database schema:', err.message);
    process.exit(1);
  });
