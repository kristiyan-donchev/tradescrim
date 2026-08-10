import { pool } from '../db.js';
import { getLeaderboard } from './portfolio.js';
import { getCompletedLessons } from './lessons.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Must match the total lesson count in client/src/lib/lessons.js (LEARN_TOPICS
// summed) — there's no shared config between client and server elsewhere in
// this app either, so this is kept in sync by hand like everything else.
const TOTAL_LESSONS = 20;

// Earned the moment a run of `threshold` consecutive first-try-perfect
// lessons is first completed (chronologically) — later imperfect lessons
// don't un-earn it, same "achieved once, stays" rule as every other
// achievement here.
function firstTryStreakEarnedAt(completions, threshold) {
  let streak = 0;
  for (const c of completions) {
    streak = c.firstTryPerfect ? streak + 1 : 0;
    if (streak >= threshold) return Number(c.completedAt);
  }
  return null;
}

// Tracks how many distinct symbols are held simultaneously as transactions
// replay in order, returning the timestamp of the transaction that first
// pushed the count to `threshold` (or null if it never has been reached).
function diversificationEarnedAt(transactions, threshold) {
  const shares = {};
  for (const t of transactions) {
    const qty = Number(t.shares);
    const current = shares[t.symbol] || 0;
    shares[t.symbol] = t.type === 'BUY' ? current + qty : current - qty;
    const distinctCount = Object.values(shares).filter((s) => s > 1e-9).length;
    if (distinctCount >= threshold) return Number(t.timestamp);
  }
  return null;
}

// A position "matures" into a long-term hold exactly 30 days after it was
// first bought — earned the moment that clock runs out, not the moment
// someone happens to check.
function longTermHolderEarnedAt(transactions, holdingSymbols, now) {
  const candidates = holdingSymbols
    .map((symbol) => {
      const firstBuy = transactions.find((t) => t.symbol === symbol && t.type === 'BUY');
      return firstBuy ? Number(firstBuy.timestamp) + 30 * DAY_MS : null;
    })
    .filter((t) => t != null && t <= now);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

// Every achievement here (other than top-of-the-board) is derived entirely
// from the user's own transaction/holdings history, so its earned date is
// exact and doesn't depend on when anyone happened to check — a user who
// hit 10 trades a week ago and only opens their profile today still sees
// last week's date, not today's.
const ACHIEVEMENTS = [
  {
    id: 'first-trade',
    title: 'First Trade',
    description: 'Place your first buy or sell order.',
    icon: 'target',
    evaluate: (ctx) => ctx.transactions[0]?.timestamp ?? null,
  },
  {
    id: 'ten-trades',
    title: 'Getting the Hang of It',
    description: 'Place 10 trades.',
    icon: 'trending-up',
    evaluate: (ctx) => ctx.transactions[9]?.timestamp ?? null,
  },
  {
    id: 'fifty-trades',
    title: 'Serial Trader',
    description: 'Place 50 trades.',
    icon: 'zap',
    evaluate: (ctx) => ctx.transactions[49]?.timestamp ?? null,
  },
  {
    id: 'diversified',
    title: 'Diversified',
    description: 'Hold 5 or more different symbols at once.',
    icon: 'grid',
    evaluate: (ctx) => diversificationEarnedAt(ctx.transactions, 5),
  },
  {
    id: 'well-diversified',
    title: 'Well Diversified',
    description: 'Hold 10 or more different symbols at once.',
    icon: 'globe',
    evaluate: (ctx) => diversificationEarnedAt(ctx.transactions, 10),
  },
  {
    id: 'crypto-curious',
    title: 'Crypto Curious',
    description: 'Trade a cryptocurrency.',
    icon: 'coins',
    evaluate: (ctx) => ctx.transactions.find((t) => t.symbol.endsWith('-USD'))?.timestamp ?? null,
  },
  {
    id: 'profit-taker',
    title: 'Profit Taker',
    description: 'Lock in a profitable sale.',
    icon: 'dollar-sign',
    evaluate: (ctx) => ctx.transactions.find((t) => t.type === 'SELL' && t.realizedPnL > 0)?.timestamp ?? null,
  },
  {
    id: 'big-winner',
    title: 'Big Winner',
    description: 'Lock in $500+ of profit on a single sale.',
    icon: 'award',
    evaluate: (ctx) => ctx.transactions.find((t) => t.type === 'SELL' && t.realizedPnL >= 500)?.timestamp ?? null,
  },
  {
    id: 'long-term-holder',
    title: 'Long-Term Holder',
    description: 'Hold a position for 30 days or more.',
    icon: 'sprout',
    evaluate: (ctx) => longTermHolderEarnedAt(ctx.transactions, ctx.holdingSymbols, Date.now()),
  },
  {
    id: 'challenger',
    title: 'Challenger',
    description: 'Complete your first challenge.',
    icon: 'swords',
    evaluate: (ctx) => ctx.challengeResults[0]?.endsAt ?? null,
  },
  {
    id: 'podium-finish',
    title: 'Podium Finish',
    description: 'Finish top 3 in a challenge.',
    icon: 'medal',
    evaluate: (ctx) => ctx.challengeResults.find((r) => r.badge === 'WINNER' || r.badge === 'TOP_3')?.endsAt ?? null,
  },
  {
    id: 'challenge-champion',
    title: 'Challenge Champion',
    description: 'Win a challenge outright.',
    icon: 'trophy',
    evaluate: (ctx) => ctx.challengeResults.find((r) => r.badge === 'WINNER')?.endsAt ?? null,
  },
  {
    id: 'challenge-regular',
    title: 'Challenge Regular',
    description: 'Complete 5 challenges.',
    icon: 'repeat',
    evaluate: (ctx) => ctx.challengeResults[4]?.endsAt ?? null,
  },
  {
    id: 'first-lesson',
    title: 'Curious Mind',
    description: 'Complete your first Learn lesson.',
    icon: 'brain',
    evaluate: (ctx) => Number(ctx.lessonCompletions[0]?.completedAt) || null,
  },
  {
    id: 'lessons-halfway',
    title: 'Halfway There',
    description: `Complete ${Math.ceil(TOTAL_LESSONS / 2)} Learn lessons.`,
    icon: 'star',
    evaluate: (ctx) => Number(ctx.lessonCompletions[Math.ceil(TOTAL_LESSONS / 2) - 1]?.completedAt) || null,
  },
  {
    id: 'market-scholar',
    title: 'Market Scholar',
    description: 'Complete every lesson in Learn.',
    icon: 'graduation-cap',
    evaluate: (ctx) =>
      ctx.lessonCompletions.length >= TOTAL_LESSONS ? Number(ctx.lessonCompletions[TOTAL_LESSONS - 1].completedAt) : null,
  },
  {
    id: 'quiz-streak-5',
    title: 'On a Roll',
    description: 'Pass 5 lesson quizzes in a row on your first try.',
    icon: 'flame',
    evaluate: (ctx) => firstTryStreakEarnedAt(ctx.lessonCompletions, 5),
  },
];

// Reach #1 unlocks like a trophy — once earned it stays earned even if rank
// later slips, since (unlike the achievements above) current leaderboard
// rank isn't part of any history we can replay, so it has to be recorded
// the first time it's observed rather than derived after the fact.
async function topOfTheBoardEarnedAt(userId, isRankOneNow) {
  if (isRankOneNow) {
    await pool.query(
      `INSERT INTO achievement_unlocks (user_id, achievement_id, earned_at)
       VALUES ($1, 'top-of-the-board', $2)
       ON CONFLICT (user_id, achievement_id) DO NOTHING`,
      [userId, Date.now()]
    );
  }
  const result = await pool.query(
    `SELECT earned_at FROM achievement_unlocks WHERE user_id = $1 AND achievement_id = 'top-of-the-board'`,
    [userId]
  );
  return result.rows[0]?.earned_at ?? null;
}

export async function getAchievements(userId) {
  const [transactionsResult, holdingsResult, leaderboard, challengeResultsResult, lessonCompletions] =
    await Promise.all([
      pool.query(
        `SELECT symbol, type, timestamp, realized_pnl AS "realizedPnL" FROM transactions
         WHERE user_id = $1 ORDER BY timestamp ASC`,
        [userId]
      ),
      pool.query(`SELECT symbol FROM holdings WHERE user_id = $1`, [userId]),
      getLeaderboard('all').catch(() => ({ leaderboard: [] })),
      pool.query(
        `SELECT cp.badge, c.ends_at AS "endsAt" FROM challenge_participants cp
         JOIN challenges c ON c.id = cp.challenge_id
         WHERE cp.user_id = $1 AND cp.badge IS NOT NULL ORDER BY c.ends_at ASC`,
        [userId]
      ),
      getCompletedLessons(userId),
    ]);

  const ctx = {
    transactions: transactionsResult.rows,
    holdingSymbols: holdingsResult.rows.map((r) => r.symbol),
    challengeResults: challengeResultsResult.rows,
    lessonCompletions,
  };
  const isRankOneNow = leaderboard.leaderboard.find((e) => e.userId === userId)?.rank === 1;

  const badges = ACHIEVEMENTS.map((a) => {
    const earnedAt = a.evaluate(ctx);
    return { id: a.id, title: a.title, description: a.description, icon: a.icon, unlocked: earnedAt != null, earnedAt };
  });

  const topEarnedAt = await topOfTheBoardEarnedAt(userId, isRankOneNow);
  badges.push({
    id: 'top-of-the-board',
    title: 'Top of the Board',
    description: 'Reach #1 on the all-time Leaderboard.',
    icon: 'crown',
    unlocked: topEarnedAt != null,
    earnedAt: topEarnedAt,
  });

  return badges;
}
