import pgPkg from 'pg';

const { Pool, types } = pgPkg;

// node-postgres returns BIGINT (OID 20) as a string by default to avoid silent
// precision loss. Our timestamps fit safely in a JS number, so parse them back.
types.setTypeParser(20, (val) => parseInt(val, 10));

export const STARTING_CASH = 10000;

// Fixed point in time email verification shipped — see the comment on the
// migration below for why this can't be Date.now().
const EMAIL_VERIFICATION_BACKFILL_CUTOFF = 1786412600000;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Point it at a Postgres instance (see server/.env.example) — ' +
      'a free Neon or Supabase database works well for both local development and production.'
  );
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      cash DOUBLE PRECISION NOT NULL DEFAULT ${STARTING_CASH},
      created_at BIGINT NOT NULL
    );

    -- Migrate existing deployments created before Google sign-in was added.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

    -- Email verification. Google sign-ups are marked verified immediately
    -- (Google already confirmed the email itself); password sign-ups start
    -- unverified and get a one-time token to confirm via email. Existing
    -- accounts from before this column existed are backfilled to verified
    -- so nobody already using the app gets locked out retroactively — using
    -- a fixed cutoff captured once here, NOT Date.now(), since initSchema()
    -- reruns on every server start and Date.now() would keep re-backfilling
    -- (i.e. auto-verifying) every real signup made after this shipped.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at BIGINT;
    UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE AND created_at < ${EMAIL_VERIFICATION_BACKFILL_CUTOFF};

    CREATE TABLE IF NOT EXISTS holdings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      shares DOUBLE PRECISION NOT NULL,
      avg_cost DOUBLE PRECISION NOT NULL,
      UNIQUE(user_id, symbol)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      shares DOUBLE PRECISION NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      total DOUBLE PRECISION NOT NULL,
      realized_pnl DOUBLE PRECISION,
      timestamp BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      added_at BIGINT NOT NULL,
      UNIQUE(user_id, symbol)
    );

    CREATE TABLE IF NOT EXISTS price_alerts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      direction TEXT NOT NULL, -- 'above' | 'below'
      target_price DOUBLE PRECISION NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at BIGINT NOT NULL,
      triggered_at BIGINT,
      triggered_price DOUBLE PRECISION,
      seen BOOLEAN NOT NULL DEFAULT TRUE
    );

    -- Limit/stop/stop-limit orders. Unlike market orders (executed inline in
    -- buyShares/sellShares), these sit PENDING until a scheduled job in
    -- index.js sees the trigger condition met and fills them at the then-
    -- current price via the same buyShares/sellShares functions.
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      side TEXT NOT NULL, -- 'BUY' | 'SELL'
      order_type TEXT NOT NULL, -- 'LIMIT' | 'STOP' | 'STOP_LIMIT'
      shares DOUBLE PRECISION NOT NULL,
      limit_price DOUBLE PRECISION,
      stop_price DOUBLE PRECISION,
      stop_triggered BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'FILLED' | 'CANCELLED'
      created_at BIGINT NOT NULL,
      filled_at BIGINT,
      filled_price DOUBLE PRECISION,
      cancel_reason TEXT
    );

    -- Most achievements' earned-at date is computed on the fly from
    -- transactions/holdings history (see lib/achievements.js) — no need to
    -- store it. The one exception is "reach #1 on the leaderboard", since
    -- rank isn't part of any historical record; the first time it's observed
    -- true, it's recorded here so the date doesn't change on later checks.
    CREATE TABLE IF NOT EXISTS achievement_unlocks (
      user_id INTEGER NOT NULL REFERENCES users(id),
      achievement_id TEXT NOT NULL,
      earned_at BIGINT NOT NULL,
      PRIMARY KEY (user_id, achievement_id)
    );

    -- One row per friend pair regardless of direction (enforced by the
    -- LEAST/GREATEST unique index below). Decline/unfriend are hard deletes —
    -- no DECLINED status — so re-requesting after a decline just works.
    CREATE TABLE IF NOT EXISTS friend_requests (
      id SERIAL PRIMARY KEY,
      requester_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'ACCEPTED'
      created_at BIGINT NOT NULL,
      responded_at BIGINT,
      CHECK (requester_id <> recipient_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_pair
      ON friend_requests (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id));
    CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient ON friend_requests(recipient_id, status);

    -- Time-boxed ROI competitions among a creator's friends. starts_at is
    -- always the creation time (no future scheduling); finalized_at stays
    -- NULL until results are computed once and locked in (see
    -- lib/challenges.js) — trading continues after ends_at, so standings
    -- can't just be derived fresh on every read like achievements are.
    CREATE TABLE IF NOT EXISTS challenges (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      starts_at BIGINT NOT NULL,
      ends_at BIGINT NOT NULL,
      created_by INTEGER REFERENCES users(id), -- nullable: creator's account may later be deleted
      created_at BIGINT NOT NULL,
      finalized_at BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_challenges_ends_at ON challenges(ends_at) WHERE finalized_at IS NULL;

    CREATE TABLE IF NOT EXISTS challenge_participants (
      challenge_id INTEGER NOT NULL REFERENCES challenges(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      joined_at BIGINT NOT NULL,
      final_rank INTEGER,
      final_roi_percent DOUBLE PRECISION,
      badge TEXT, -- NULL until finalized, then 'WINNER' | 'TOP_3' | 'PARTICIPANT'
      PRIMARY KEY (challenge_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON challenge_participants(user_id);

    -- In-app bug reports (Sidebar "Report a bug"). user_id is nullable —
    -- deleting an account nulls it out rather than deleting the report, so
    -- reports outlive the account that filed them (same pattern as
    -- challenges.created_by).
    CREATE TABLE IF NOT EXISTS bug_reports (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      description TEXT NOT NULL,
      page TEXT,
      user_agent TEXT,
      created_at BIGINT NOT NULL
    );

    -- One row per lesson a user has ever completed (first completion only —
    -- re-completing doesn't move completed_at or first_try_perfect). Backs
    -- the Learn achievements below and lets progress/streaks survive across
    -- devices, unlike the old localStorage-only tracking. Guests (no
    -- account) never write here — they keep the localStorage-only behavior
    -- and don't earn badges, same tradeoff as every other achievement.
    CREATE TABLE IF NOT EXISTS lesson_completions (
      user_id INTEGER NOT NULL REFERENCES users(id),
      lesson_id TEXT NOT NULL,
      completed_at BIGINT NOT NULL,
      first_try_perfect BOOLEAN NOT NULL,
      PRIMARY KEY (user_id, lesson_id)
    );

    -- Personal-best/history storage for the Games tab. One row per completed
    -- play of any game; meta holds game-specific extras (e.g. which assets
    -- were picked) that aren't needed for scoring/leaderboard purposes but
    -- are handy to keep. Scores are just "bigger is better" ints — each
    -- game's own scoring function decides what that means for that game.
    CREATE TABLE IF NOT EXISTS game_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      game_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      played_at BIGINT NOT NULL,
      meta JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_game_results_user_game ON game_results(user_id, game_id);
  `);
}
