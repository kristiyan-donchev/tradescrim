import { COOKIE_NAME, verifyToken } from '../lib/jwt.js';
import { findUserById } from '../lib/users.js';
import { isAdminUser, isFeatureEnabled } from '../lib/features.js';

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  let userId;
  try {
    userId = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Not logged in.' });
    }
    req.userId = userId;
    req.user = user;
    next();
  } catch (err) {
    console.error('auth lookup error', err.message);
    res.status(500).json({ error: 'Something went wrong checking your session.' });
  }
}

// Resolves req.userId when a valid session cookie is present, but never
// rejects the request — for routes that are public but behave slightly
// differently when the caller happens to be logged in (e.g. the leaderboard's
// friends-only scope).
export async function optionalAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    const userId = verifyToken(token);
    const user = await findUserById(userId);
    if (user) {
      req.userId = userId;
      req.user = user;
    }
  } catch {
    // Invalid/expired token: treat the same as no session rather than erroring.
  }
  next();
}

// Must run after requireAuth.
export function requireAdmin(req, res, next) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admins only.' });
  }
  next();
}

// Hides an unpublished feature's endpoints from everyone but admins — a 404
// rather than a 403, so the route looks like it doesn't exist yet. Must run
// after requireAuth or optionalAuth.
export function requireFeature(key) {
  return async (req, res, next) => {
    try {
      if (await isFeatureEnabled(key, req.user)) return next();
      res.status(404).json({ error: 'Not found.' });
    } catch (err) {
      console.error('feature check error', err.message);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  };
}
