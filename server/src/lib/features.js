import { pool } from '../db.js';

// Every feature that can be held back behind a flag. A feature listed here
// starts unpublished: only admins can see and use it (so it can be tested on
// the live site) until it's published from the Admin page, at which point
// everyone gets it. Once a feature is published for good, delete its entry
// here along with the requireFeature/isEnabled checks for it.
export const FEATURES = [
  {
    key: 'profile-privacy',
    name: 'Public & private profiles',
    description:
      'Clickable trader profiles on the leaderboard and friends list that show holdings and trade history, plus a Settings option to make your own profile private.',
  },
];

const FEATURE_KEYS = new Set(FEATURES.map((f) => f.key));

export function isKnownFeature(key) {
  return FEATURE_KEYS.has(key);
}

// Admins are configured by email via ADMIN_EMAILS rather than a DB column, so
// there's no endpoint that could ever grant admin. The email must also be
// verified — otherwise someone who signs up first with an admin's address
// (before that person has an account) would inherit admin.
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isAdminUser(user) {
  return Boolean(user && user.email_verified && ADMIN_EMAILS.has(user.email.toLowerCase()));
}

export async function getPublishedFeatureKeys() {
  const result = await pool.query(`SELECT key FROM feature_flags WHERE published = TRUE`);
  return new Set(result.rows.map((r) => r.key).filter(isKnownFeature));
}

export async function isFeatureEnabled(key, user) {
  if (isAdminUser(user)) return true;
  return (await getPublishedFeatureKeys()).has(key);
}

export async function listFeaturesForAdmin() {
  const result = await pool.query(`SELECT key, published, updated_at FROM feature_flags`);
  const byKey = new Map(result.rows.map((r) => [r.key, r]));
  return FEATURES.map((f) => ({
    ...f,
    published: Boolean(byKey.get(f.key)?.published),
    updatedAt: byKey.get(f.key)?.updated_at ?? null,
  }));
}

export async function setFeaturePublished(key, published) {
  await pool.query(
    `INSERT INTO feature_flags (key, published, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET published = EXCLUDED.published, updated_at = EXCLUDED.updated_at`,
    [key, published, Date.now()]
  );
}
