import { pool } from '../db.js';
import { isAdminUser } from './features.js';

const PROFILE_TRANSACTIONS_LIMIT = 50;

// What another user (or a guest) sees when they open someone's profile from
// the leaderboard or friends list. Holdings and trade history are only
// included when the owner has made their profile public — or when the
// viewer is the owner. Cash is never included either way.
export async function getUserProfile(userId, viewerId) {
  const userResult = await pool.query(
    `SELECT id, username, email, email_verified, created_at, profile_public FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) return null;

  // email/email_verified are selected only to work out isAdmin — never
  // include them in the returned profile.
  const profile = {
    id: user.id,
    username: user.username,
    createdAt: user.created_at,
    isPrivate: !user.profile_public,
    isAdmin: isAdminUser(user),
  };
  if (profile.isPrivate && viewerId !== user.id) return profile;

  const [holdingsResult, transactionsResult] = await Promise.all([
    pool.query(
      `SELECT symbol, name, shares, avg_cost AS "avgCost" FROM holdings WHERE user_id = $1 ORDER BY symbol`,
      [userId]
    ),
    pool.query(
      `SELECT id, symbol, name, type, shares, price, total, realized_pnl AS "realizedPnL", timestamp
       FROM transactions WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [userId, PROFILE_TRANSACTIONS_LIMIT]
    ),
  ]);
  return { ...profile, holdings: holdingsResult.rows, transactions: transactionsResult.rows };
}
