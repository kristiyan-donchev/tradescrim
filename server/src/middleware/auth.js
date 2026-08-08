import { COOKIE_NAME, verifyToken } from '../lib/jwt.js';
import { findUserById } from '../lib/users.js';

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
    if (user) req.userId = userId;
  } catch {
    // Invalid/expired token: treat the same as no session rather than erroring.
  }
  next();
}
