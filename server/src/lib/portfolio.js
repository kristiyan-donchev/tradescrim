import crypto from 'crypto';
import { pool, STARTING_CASH } from '../db.js';
import { yahooFinance } from './yahoo.js';
import { computeNewAvgCost, computeRealizedPnL, computeRemainingShares } from './costBasis.js';

const HOLDINGS_SELECT = `SELECT symbol, name, shares, avg_cost AS "avgCost" FROM holdings WHERE user_id = $1`;
const TRANSACTIONS_SELECT = `
  SELECT id, symbol, name, type, shares, price, total, realized_pnl AS "realizedPnL", timestamp
  FROM transactions WHERE user_id = $1 ORDER BY timestamp DESC
`;

// interval/lookback-days per requested range; 'all' has no fixed lookback since
// it's bounded by the account's creation date instead.
const PERFORMANCE_RANGE_CONFIG = {
  '1d': { interval: '5m', days: 1 },
  '1w': { interval: '15m', days: 7 },
  '1mo': { interval: '1d', days: 31 },
  '3mo': { interval: '1d', days: 92 },
  '6mo': { interval: '1d', days: 183 },
  '1y': { interval: '1d', days: 365 },
  all: { interval: '1d', days: null },
};

function holdingsMap(rows) {
  const map = {};
  for (const row of rows) {
    map[row.symbol] = row;
  }
  return map;
}

export async function getPortfolio(userId) {
  const [userResult, holdingsResult, transactionsResult] = await Promise.all([
    pool.query(`SELECT cash FROM users WHERE id = $1`, [userId]),
    pool.query(HOLDINGS_SELECT, [userId]),
    pool.query(TRANSACTIONS_SELECT, [userId]),
  ]);
  return {
    cash: userResult.rows[0].cash,
    holdings: holdingsMap(holdingsResult.rows),
    transactions: transactionsResult.rows,
  };
}

export async function buyShares(userId, { symbol, name, shares, price }) {
  if (!(shares > 0)) throw new Error('Enter a positive number of shares.');
  const cost = shares * price;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(`SELECT cash FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const cash = userResult.rows[0].cash;
    if (cost > cash + 1e-9) throw new Error('Not enough virtual cash for this order.');

    const existingResult = await client.query(
      `SELECT symbol, name, shares, avg_cost AS "avgCost" FROM holdings WHERE user_id = $1 AND symbol = $2`,
      [userId, symbol]
    );
    const existing = existingResult.rows[0];
    const newShares = (existing?.shares || 0) + shares;
    const newAvgCost = computeNewAvgCost(existing?.shares || 0, existing?.avgCost || 0, shares, price);

    await client.query(`UPDATE users SET cash = $1 WHERE id = $2`, [cash - cost, userId]);
    await client.query(
      `INSERT INTO holdings (user_id, symbol, name, shares, avg_cost)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, symbol)
       DO UPDATE SET shares = EXCLUDED.shares, avg_cost = EXCLUDED.avg_cost, name = EXCLUDED.name`,
      [userId, symbol, name, newShares, newAvgCost]
    );
    await client.query(
      `INSERT INTO transactions (id, user_id, symbol, name, type, shares, price, total, realized_pnl, timestamp)
       VALUES ($1, $2, $3, $4, 'BUY', $5, $6, $7, NULL, $8)`,
      [crypto.randomUUID(), userId, symbol, name, shares, price, cost, Date.now()]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getPortfolio(userId);
}

export async function sellShares(userId, { symbol, name, shares, price }) {
  if (!(shares > 0)) throw new Error('Enter a positive number of shares.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(`SELECT cash FROM users WHERE id = $1 FOR UPDATE`, [userId]);
    const cash = userResult.rows[0].cash;

    const existingResult = await client.query(
      `SELECT symbol, name, shares, avg_cost AS "avgCost" FROM holdings WHERE user_id = $1 AND symbol = $2`,
      [userId, symbol]
    );
    const existing = existingResult.rows[0];
    if (!existing || shares > existing.shares + 1e-9) {
      throw new Error(`You only own ${existing?.shares || 0} share(s) of ${symbol}.`);
    }

    const proceeds = shares * price;
    const realizedPnL = computeRealizedPnL(existing.avgCost, shares, price);
    const remainingShares = computeRemainingShares(existing.shares, shares);

    await client.query(`UPDATE users SET cash = $1 WHERE id = $2`, [cash + proceeds, userId]);
    if (remainingShares <= 1e-9) {
      await client.query(`DELETE FROM holdings WHERE user_id = $1 AND symbol = $2`, [userId, symbol]);
    } else {
      await client.query(`UPDATE holdings SET shares = $1 WHERE user_id = $2 AND symbol = $3`, [
        remainingShares,
        userId,
        symbol,
      ]);
    }
    await client.query(
      `INSERT INTO transactions (id, user_id, symbol, name, type, shares, price, total, realized_pnl, timestamp)
       VALUES ($1, $2, $3, $4, 'SELL', $5, $6, $7, $8, $9)`,
      [crypto.randomUUID(), userId, symbol, name, shares, price, proceeds, realizedPnL, Date.now()]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getPortfolio(userId);
}

// Reconstructs portfolio value (cash + holdings, marked at each historical price
// point) over time from the transaction log and Yahoo's historical prices, since
// no periodic net-worth snapshots are stored anywhere. Works from account
// inception forward so balances carried into the requested window are correct
// even when the range starts mid-history.
export async function getPerformance(userId, range) {
  const config = PERFORMANCE_RANGE_CONFIG[range] || PERFORMANCE_RANGE_CONFIG['1mo'];

  const userResult = await pool.query(`SELECT created_at FROM users WHERE id = $1`, [userId]);
  const createdAt = userResult.rows[0].created_at;

  const now = Date.now();
  const rangeStart = config.days != null ? now - config.days * 24 * 60 * 60 * 1000 : createdAt;
  const period1 = new Date(Math.max(rangeStart, createdAt));
  const period2 = new Date(now);
  // Yahoo's chart endpoint rejects period1 === period2, which happens for any
  // account created within the last moment (i.e. every brand-new signup) since
  // `period1` above is clamped to `createdAt`. Fetch a padded window so the
  // request stays valid, but keep filtering results to the real range below.
  const fetchPeriod1 = new Date(Math.min(createdAt, now - 24 * 60 * 60 * 1000));

  const txResult = await pool.query(
    `SELECT symbol, type, shares, price, timestamp FROM transactions WHERE user_id = $1 ORDER BY timestamp ASC`,
    [userId]
  );
  const transactions = txResult.rows;
  const symbols = [...new Set(transactions.map((t) => t.symbol))];

  const priceHistories = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const chart = await yahooFinance.chart(symbol, {
          period1: fetchPeriod1,
          period2,
          interval: config.interval,
        });
        priceHistories[symbol] = (chart.quotes || [])
          .filter((q) => q.close != null)
          .map((q) => ({ time: new Date(q.date).getTime(), close: q.close }));
      } catch (err) {
        console.error(`performance: failed to fetch history for ${symbol}`, err.message);
        priceHistories[symbol] = [];
      }
    })
  );

  const timelineSet = new Set();
  // Always anchor the timeline to the full requested span so the chart draws a
  // line (not a single dot) even when there's little or no price data inside
  // it yet — e.g. an account created earlier today.
  timelineSet.add(period1.getTime());
  timelineSet.add(period2.getTime());
  for (const symbol of symbols) {
    for (const point of priceHistories[symbol]) {
      if (point.time >= period1.getTime() && point.time <= period2.getTime()) {
        timelineSet.add(point.time);
      }
    }
  }
  const timeline = [...timelineSet].sort((a, b) => a - b);

  function priceAt(symbol, time) {
    const history = priceHistories[symbol];
    if (!history || history.length === 0) return null;
    let price = null;
    for (const point of history) {
      if (point.time > time) break;
      price = point.close;
    }
    return price ?? history[0].close;
  }

  let txIndex = 0;
  let cash = STARTING_CASH;
  const shares = {};

  const points = timeline.map((time) => {
    while (txIndex < transactions.length && Number(transactions[txIndex].timestamp) <= time) {
      const t = transactions[txIndex];
      const qty = Number(t.shares);
      if (t.type === 'BUY') {
        cash -= qty * Number(t.price);
        shares[t.symbol] = (shares[t.symbol] || 0) + qty;
      } else {
        cash += qty * Number(t.price);
        shares[t.symbol] = (shares[t.symbol] || 0) - qty;
      }
      txIndex += 1;
    }

    let holdingsValue = 0;
    for (const [symbol, qty] of Object.entries(shares)) {
      if (qty <= 1e-9) continue;
      holdingsValue += qty * (priceAt(symbol, time) ?? 0);
    }

    const value = cash + holdingsValue;
    return {
      date: new Date(time).toISOString(),
      value,
      roiPercent: ((value - STARTING_CASH) / STARTING_CASH) * 100,
    };
  });

  return { range, startingCash: STARTING_CASH, points };
}

// Ranks a given set of {userId, username, periodStart} participants by
// portfolio return over their individual window: (value now - value at
// periodStart) / value at periodStart. Shared by getLeaderboard() (every
// user, periodStart clamped to signup) and challenge standings (just the
// challenge's participants, periodStart clamped to when each of them joined).
// Price history is fetched once per symbol and shared across all
// participants to avoid hitting Yahoo once per user.
export async function computeRoiRankings(participants, { endTime, interval = '1d' } = {}) {
  const now = endTime ?? Date.now();
  if (participants.length === 0) return [];

  const userIds = participants.map((p) => p.userId);
  const txResult = await pool.query(
    `SELECT user_id, symbol, type, shares, price, timestamp FROM transactions
     WHERE user_id = ANY($1::int[]) ORDER BY user_id, timestamp ASC`,
    [userIds]
  );
  const txByUser = {};
  for (const t of txResult.rows) {
    if (!txByUser[t.user_id]) txByUser[t.user_id] = [];
    txByUser[t.user_id].push(t);
  }
  const symbols = [...new Set(txResult.rows.map((t) => t.symbol))];

  const earliestPeriodStart = Math.min(...participants.map((p) => p.periodStart));
  const fetchPeriod1 = new Date(Math.min(earliestPeriodStart, now - 24 * 60 * 60 * 1000));
  const period2 = new Date(now);

  const priceHistories = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const chart = await yahooFinance.chart(symbol, { period1: fetchPeriod1, period2, interval });
        priceHistories[symbol] = (chart.quotes || [])
          .filter((q) => q.close != null)
          .map((q) => ({ time: new Date(q.date).getTime(), close: q.close }));
      } catch (err) {
        console.error(`roi rankings: failed to fetch history for ${symbol}`, err.message);
        priceHistories[symbol] = [];
      }
    })
  );

  function priceAt(symbol, time) {
    const history = priceHistories[symbol];
    if (!history || history.length === 0) return null;
    let price = null;
    for (const point of history) {
      if (point.time > time) break;
      price = point.close;
    }
    return price ?? history[0].close;
  }

  function valueAt(transactions, time) {
    let cash = STARTING_CASH;
    const shares = {};
    for (const t of transactions) {
      if (Number(t.timestamp) > time) break;
      const qty = Number(t.shares);
      if (t.type === 'BUY') {
        cash -= qty * Number(t.price);
        shares[t.symbol] = (shares[t.symbol] || 0) + qty;
      } else {
        cash += qty * Number(t.price);
        shares[t.symbol] = (shares[t.symbol] || 0) - qty;
      }
    }
    let holdingsValue = 0;
    for (const [symbol, qty] of Object.entries(shares)) {
      if (qty <= 1e-9) continue;
      holdingsValue += qty * (priceAt(symbol, time) ?? 0);
    }
    return cash + holdingsValue;
  }

  const rankings = participants.map((p) => {
    const transactions = txByUser[p.userId] || [];
    const startValue = valueAt(transactions, p.periodStart);
    const currentValue = valueAt(transactions, now);
    const roiPercent = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0;
    return { userId: p.userId, username: p.username, value: currentValue, roiPercent };
  });

  rankings.sort((a, b) => b.roiPercent - a.roiPercent);
  // Standard competition ranking (1, 1, 3 — not 1, 1, 2), so a tie at the top
  // produces multiple winners instead of an arbitrary, insertion-order pick.
  let prevRoi = null;
  let prevRank = 0;
  rankings.forEach((entry, i) => {
    if (prevRoi !== null && Math.abs(entry.roiPercent - prevRoi) < 1e-9) {
      entry.rank = prevRank;
    } else {
      entry.rank = i + 1;
      prevRank = entry.rank;
    }
    prevRoi = entry.roiPercent;
  });

  return rankings;
}

// For a user who joined after the window start, the window is clamped to
// their signup (value at signup is always exactly STARTING_CASH, before any
// trades), so 'all' naturally reduces to total return since inception
// without needing a special case. `userIds`, when passed, scopes the board to
// that set of users (e.g. a friends-only view) instead of everyone.
export async function getLeaderboard(range, { userIds } = {}) {
  const config = PERFORMANCE_RANGE_CONFIG[range] || PERFORMANCE_RANGE_CONFIG['1mo'];
  const now = Date.now();

  const usersResult = await pool.query(
    `SELECT id, username, created_at FROM users WHERE ($1::int[] IS NULL OR id = ANY($1::int[])) ORDER BY id`,
    [userIds ?? null]
  );
  const users = usersResult.rows;
  if (users.length === 0) return { range, leaderboard: [] };

  const rangeStart = config.days != null ? now - config.days * 24 * 60 * 60 * 1000 : null;
  const participants = users.map((user) => {
    const createdAt = Number(user.created_at);
    return {
      userId: user.id,
      username: user.username,
      periodStart: rangeStart != null ? Math.max(rangeStart, createdAt) : createdAt,
    };
  });

  const rankings = await computeRoiRankings(participants, { endTime: now, interval: config.interval });
  return { range, leaderboard: rankings.slice(0, 100) };
}

// Leaderboard cuts other than ROI. Unlike getLeaderboard() above, these never
// need Yahoo price history — trade count, best single win, and current
// diversification are all directly queryable from transactions/holdings.
// `userIds`, when passed, scopes each board to that set of users.

export async function getMostActiveLeaderboard(range, { userIds } = {}) {
  const config = PERFORMANCE_RANGE_CONFIG[range] || PERFORMANCE_RANGE_CONFIG['1mo'];
  const windowStart = config.days != null ? Date.now() - config.days * 24 * 60 * 60 * 1000 : null;

  const result = await pool.query(
    `SELECT u.id AS "userId", u.username,
            COALESCE(COUNT(t.id), 0)::int AS "tradeCount"
     FROM users u
     LEFT JOIN transactions t ON t.user_id = u.id AND ($1::bigint IS NULL OR t.timestamp >= $1)
     WHERE ($2::int[] IS NULL OR u.id = ANY($2::int[]))
     GROUP BY u.id, u.username
     ORDER BY "tradeCount" DESC, u.id ASC`,
    [windowStart, userIds ?? null]
  );
  const leaderboard = result.rows.map((row, i) => ({ ...row, rank: i + 1 }));
  return { range, category: 'active', leaderboard: leaderboard.slice(0, 100) };
}

export async function getBiggestWinLeaderboard(range, { userIds } = {}) {
  const config = PERFORMANCE_RANGE_CONFIG[range] || PERFORMANCE_RANGE_CONFIG['1mo'];
  const windowStart = config.days != null ? Date.now() - config.days * 24 * 60 * 60 * 1000 : null;

  const result = await pool.query(
    `SELECT u.id AS "userId", u.username,
            COALESCE(MAX(t.realized_pnl), 0) AS "bestWin",
            (ARRAY_AGG(t.symbol ORDER BY t.realized_pnl DESC))[1] AS "bestWinSymbol"
     FROM users u
     LEFT JOIN transactions t ON t.user_id = u.id AND t.type = 'SELL' AND t.realized_pnl IS NOT NULL
       AND ($1::bigint IS NULL OR t.timestamp >= $1)
     WHERE ($2::int[] IS NULL OR u.id = ANY($2::int[]))
     GROUP BY u.id, u.username
     ORDER BY "bestWin" DESC, u.id ASC`,
    [windowStart, userIds ?? null]
  );
  const leaderboard = result.rows.map((row, i) => ({ ...row, rank: i + 1 }));
  return { range, category: 'biggest_win', leaderboard: leaderboard.slice(0, 100) };
}

export async function getDiversificationLeaderboard({ userIds } = {}) {
  const result = await pool.query(
    `SELECT u.id AS "userId", u.username,
            COALESCE(COUNT(DISTINCT h.symbol), 0)::int AS "holdingCount"
     FROM users u
     LEFT JOIN holdings h ON h.user_id = u.id
     WHERE ($1::int[] IS NULL OR u.id = ANY($1::int[]))
     GROUP BY u.id, u.username
     ORDER BY "holdingCount" DESC, u.id ASC`,
    [userIds ?? null]
  );
  const leaderboard = result.rows.map((row, i) => ({ ...row, rank: i + 1 }));
  return { category: 'diversified', leaderboard: leaderboard.slice(0, 100) };
}

export async function resetPortfolio(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE users SET cash = $1 WHERE id = $2`, [STARTING_CASH, userId]);
    await client.query(`DELETE FROM holdings WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM transactions WHERE user_id = $1`, [userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getPortfolio(userId);
}
