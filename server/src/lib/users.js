import { pool, STARTING_CASH } from '../db.js';

export async function createUser({ username, email, passwordHash }) {
  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash, cash, created_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [username, email, passwordHash, STARTING_CASH, Date.now()]
  );
  return result.rows[0];
}

export async function findUserByUsername(username) {
  const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
  return result.rows[0] || null;
}

export async function findUserByEmail(email) {
  const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function findUserByGoogleId(googleId) {
  const result = await pool.query(`SELECT * FROM users WHERE google_id = $1`, [googleId]);
  return result.rows[0] || null;
}

export async function createGoogleUser({ username, email, googleId }) {
  const result = await pool.query(
    `INSERT INTO users (username, email, google_id, cash, created_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [username, email, googleId, STARTING_CASH, Date.now()]
  );
  return result.rows[0];
}

export async function linkGoogleId(userId, googleId) {
  const result = await pool.query(`UPDATE users SET google_id = $1 WHERE id = $2 RETURNING *`, [
    googleId,
    userId,
  ]);
  return result.rows[0];
}

// Derives a username candidate from an email's local part, falling back to a
// generic prefix and appending a numeric suffix until it's unique.
export async function generateUsernameFromEmail(email) {
  const base = (email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user').slice(0, 20);
  const stem = base.length >= 3 ? base : `user${base}`;

  let candidate = stem;
  let suffix = 0;
  while (await findUserByUsername(candidate)) {
    suffix += 1;
    candidate = `${stem}${suffix}`.slice(0, 24);
  }
  return candidate;
}

export async function updateUsername(userId, username) {
  const result = await pool.query(`UPDATE users SET username = $1 WHERE id = $2 RETURNING *`, [
    username,
    userId,
  ]);
  return result.rows[0];
}

export async function updatePasswordHash(userId, passwordHash) {
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);
}

// Deletes a user and everything scoped to them. None of these tables have
// ON DELETE CASCADE, so every one of them must be cleared manually in the
// same transaction before the users row itself — otherwise deletion throws a
// foreign-key violation for any user who has ever done the thing that table
// tracks (watchlist/price_alerts/orders/achievement_unlocks were previously
// missing here entirely, which meant deleting an account with any of those
// failed; confirmed by reproducing it against a user with an earned
// achievement while building the friends/challenges feature below).
// challenges.created_by is nullable specifically so a challenge other users
// have joined survives its creator's account being deleted.
export async function deleteAccount(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM watchlist WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM price_alerts WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM orders WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM achievement_unlocks WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM lesson_completions WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM game_results WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM friend_requests WHERE requester_id = $1 OR recipient_id = $1`, [userId]);
    await client.query(`DELETE FROM challenge_participants WHERE user_id = $1`, [userId]);
    await client.query(`UPDATE challenges SET created_by = NULL WHERE created_by = $1`, [userId]);
    await client.query(`UPDATE bug_reports SET user_id = NULL WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM transactions WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM holdings WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.created_at,
    hasPassword: Boolean(user.password_hash),
  };
}
