import { pool } from '../db.js';
import { yahooFinance } from './yahoo.js';
import { getMarketNews } from './news.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function recordGameResult(userId, gameId, score, meta) {
  await pool.query(
    `INSERT INTO game_results (user_id, game_id, score, played_at, meta) VALUES ($1, $2, $3, $4, $5)`,
    [userId, gameId, score, Date.now(), meta ? JSON.stringify(meta) : null]
  );
}

export async function getPersonalBests(userId) {
  const result = await pool.query(
    `SELECT game_id AS "gameId", MAX(score) AS "bestScore", COUNT(*) AS "plays"
     FROM game_results WHERE user_id = $1 GROUP BY game_id`,
    [userId]
  );
  return result.rows.map((r) => ({ gameId: r.gameId, bestScore: Number(r.bestScore), plays: Number(r.plays) }));
}

// Ranked by each player's own best score for the one game requested — an
// inner join, so only people who've actually played that specific game show
// up (a leaderboard row of "never played" would just be clutter). `userIds`,
// when passed, scopes the board to that set of users (friends-only view),
// same pattern as the portfolio leaderboards.
export async function getGamesLeaderboard(gameId, { userIds } = {}) {
  const result = await pool.query(
    `SELECT u.id AS "userId", u.username, MAX(g.score) AS "bestScore"
     FROM game_results g
     JOIN users u ON u.id = g.user_id
     WHERE g.game_id = $1 AND ($2::int[] IS NULL OR u.id = ANY($2::int[]))
     GROUP BY u.id, u.username
     ORDER BY "bestScore" DESC, u.id ASC`,
    [gameId, userIds ?? null]
  );
  const leaderboard = result.rows.map((row, i) => ({ ...row, bestScore: Number(row.bestScore), rank: i + 1 }));
  return { gameId, leaderboard: leaderboard.slice(0, 100) };
}

// A deliberately small, liquid, well-known pool — keeps "Guess the Chart"
// fair (no obscure penny stocks with erratic single-trade price jumps) and
// keeps the odds of Yahoo returning bad/missing data for a pick low.
const CHART_POOL = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX', 'AMD', 'DIS',
  'KO', 'PEP', 'JNJ', 'PG', 'WMT', 'JPM', 'V', 'MA', 'HD', 'COST',
  'BA', 'INTC', 'CSCO', 'ORCL', 'ADBE', 'CRM', 'NKE', 'MCD', 'SBUX', 'XOM',
];

async function fetchThreeMonthReturn(symbol) {
  const period2 = new Date();
  const period1 = new Date(period2.getTime() - 92 * DAY_MS);
  const chart = await yahooFinance.chart(symbol, { period1, period2, interval: '1d' });
  const points = (chart.quotes || [])
    .filter((q) => q.close != null)
    .map((q) => ({ date: q.date, close: q.close }));
  if (points.length < 10) throw new Error(`Not enough history for ${symbol}`);
  const changePercent = ((points[points.length - 1].close - points[0].close) / points[0].close) * 100;
  return { symbol, points, changePercent };
}

function pickTwoDistinct(pool) {
  const a = pool[Math.floor(Math.random() * pool.length)];
  let b = a;
  while (b === a) b = pool[Math.floor(Math.random() * pool.length)];
  return [a, b];
}

// Blinded head-to-head: two real 3-month price series, no symbols shown
// until after the guess, since the point is reading the shape of the line
// rather than recognizing the ticker.
export async function getChartPair() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [symA, symB] = pickTwoDistinct(CHART_POOL);
    try {
      const [a, b] = await Promise.all([fetchThreeMonthReturn(symA), fetchThreeMonthReturn(symB)]);
      return { a, b };
    } catch {
      // try a different random pair
    }
  }
  throw new Error('Could not load two chart series right now.');
}

// A real headline (already fetched market-wide for the News tab) paired with
// whether the stock it's about actually went up or down that day - the
// player is guessing real market reaction, not a scripted outcome.
export async function getBullBearRound() {
  const news = await getMarketNews();
  const candidates = news.filter((n) => n.relatedTickers?.length > 0 && n.publishedAt);
  shuffle(candidates);

  for (const article of candidates.slice(0, 8)) {
    const symbol = article.relatedTickers[0];
    try {
      const publishedDate = new Date(article.publishedAt);
      // Most articles are from today, before today's own daily candle is
      // even available - rather than requiring data points that precisely
      // bracket the exact publish timestamp (which fails for same-day
      // news), just use the two most recent trading days available in a
      // window around it. Good enough for "did this stock move around
      // when this news came out" as a trivia prompt, not a backtest.
      const period1 = new Date(publishedDate.getTime() - 8 * DAY_MS);
      const period2 = new Date(publishedDate.getTime() + 2 * DAY_MS);
      const chart = await yahooFinance.chart(symbol, { period1, period2, interval: '1d' });
      const points = (chart.quotes || []).filter((q) => q.close != null);
      if (points.length < 2) continue;

      const before = points[points.length - 2];
      const after = points[points.length - 1];
      const changePercent = ((after.close - before.close) / before.close) * 100;
      return {
        headline: article.title,
        publisher: article.publisher,
        symbol,
        direction: changePercent >= 0 ? 'up' : 'down',
        changePercent,
      };
    } catch {
      // try the next candidate article
    }
  }
  throw new Error('Could not find a suitable headline right now.');
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
