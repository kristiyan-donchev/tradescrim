import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  createUser,
  findUserByUsername,
  findUserByEmail,
  findUserById,
  findUserByGoogleId,
  createGoogleUser,
  linkGoogleId,
  generateUsernameFromEmail,
  updateUsername,
  updatePasswordHash,
  deleteAccount,
  toPublicUser,
} from '../lib/users.js';
import { signToken, COOKIE_NAME } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const IS_PROD = process.env.NODE_ENV === 'production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0];
// CLIENT_ORIGIN must stay a bare origin (scheme+host) to match the browser's Origin
// header for CORS. CLIENT_APP_URL exists separately for cases where the page Google
// should redirect back to after login differs from that bare origin.
const CLIENT_APP_URL = process.env.CLIENT_APP_URL || CLIENT_ORIGIN;

// The OAuth state param is tracked here, server-side, rather than in a
// cookie on the browser. A cookie was the standard approach, but real-world
// testing found iOS Safari dropping it entirely across the redirect through
// accounts.google.com — the callback request arrived with no Cookie header
// at all — even though it's a same-host, top-level-navigation-only cookie
// that ordinary SameSite rules say should survive. A server-side, single-use,
// short-lived nonce sidesteps browser cookie behavior completely: the state
// value's own entropy plus one-time use is what prevents CSRF, not tying it
// to a particular browser session.
const PENDING_OAUTH_STATES = new Map(); // state -> expiresAt
const OAUTH_STATE_TTL_MS = 5 * 60 * 1000;

function issueOAuthState() {
  const now = Date.now();
  for (const [key, expiresAt] of PENDING_OAUTH_STATES) {
    if (expiresAt < now) PENDING_OAUTH_STATES.delete(key);
  }
  const state = crypto.randomBytes(16).toString('hex');
  PENDING_OAUTH_STATES.set(state, now + OAUTH_STATE_TTL_MS);
  return state;
}

function consumeOAuthState(state) {
  const expiresAt = PENDING_OAUTH_STATES.get(state);
  PENDING_OAUTH_STATES.delete(state);
  return typeof expiresAt === 'number' && expiresAt >= Date.now();
}

// Google sign-in still fails on iOS even with the state fix above: the
// callback response itself is the direct target of a cross-site redirect
// (the previous page was accounts.google.com), and Safari drops Set-Cookie
// on that response regardless of the cookie's own Domain/SameSite attributes
// — it's the response's redirect provenance that gets flagged, not the
// cookie. The fix is to never set the session cookie on that response at
// all: redirect back with a one-time exchange token instead, which the
// frontend immediately trades for a session via a normal same-origin-style
// fetch() — the same mechanism password login already uses successfully,
// since a JS-initiated fetch isn't part of any redirect chain.
const PENDING_LOGIN_EXCHANGES = new Map(); // token -> { userId, expiresAt }
const LOGIN_EXCHANGE_TTL_MS = 2 * 60 * 1000;

function issueLoginExchangeToken(userId) {
  const now = Date.now();
  for (const [key, entry] of PENDING_LOGIN_EXCHANGES) {
    if (entry.expiresAt < now) PENDING_LOGIN_EXCHANGES.delete(key);
  }
  const token = crypto.randomBytes(24).toString('hex');
  PENDING_LOGIN_EXCHANGES.set(token, { userId, expiresAt: now + LOGIN_EXCHANGE_TTL_MS });
  return token;
}

function consumeLoginExchangeToken(token) {
  const entry = PENDING_LOGIN_EXCHANGES.get(token);
  PENDING_LOGIN_EXCHANGES.delete(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.userId;
}

// Scopes the cookie to the shared parent domain (api.tradescrim.com and
// tradescrim.com are then same-site siblings) instead of relying on
// SameSite=None alone — iOS Safari (and every browser on iOS, since Apple
// forces them all onto WebKit) blocks third-party SameSite=None cookies
// outright, which broke Google sign-in on phones even though it worked in
// desktop testing. Same-site sibling cookies aren't subject to that block.
const COOKIE_DOMAIN = IS_PROD ? '.tradescrim.com' : undefined;

// Cross-site cookies (frontend and backend on different domains in production)
// require SameSite=None, which browsers only honor when Secure is also set.
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: IS_PROD ? 'none' : 'lax',
  secure: IS_PROD,
  domain: COOKIE_DOMAIN,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: IS_PROD ? 'none' : 'lax',
  secure: IS_PROD,
  domain: COOKIE_DOMAIN,
};

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body || {};

  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-24 characters (letters, numbers, underscore).' });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    if (await findUserByUsername(username)) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    if (await findUserByEmail(email)) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({ username, email, passwordHash });

    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    // Also returned in the body — see the comment on persistSessionCookie in
    // client/src/lib/api.js for why the client writes this cookie itself too.
    res.status(201).json({ user: toPublicUser(user), token });
  } catch (err) {
    console.error('signup error', err.message);
    res.status(500).json({ error: 'Something went wrong creating your account.' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = (await findUserByUsername(username)) || (await findUserByEmail(username));
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    if (!user.password_hash) {
      return res.status(401).json({ error: 'That account signs in with Google. Use the Google button below.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json({ user: toPublicUser(user), token });
  } catch (err) {
    console.error('login error', err.message);
    res.status(500).json({ error: 'Something went wrong logging you in.' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
  res.json({ ok: true });
});

router.get('/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    return res.status(500).send('Google sign-in is not configured on this server.');
  }

  const state = issueOAuthState();

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || !consumeOAuthState(state)) {
    console.error('google auth error: state check failed', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      userAgent: req.headers['user-agent'],
    });
    return res.redirect(`${CLIENT_APP_URL}?authError=google`);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Google token exchange failed.');

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profileRes.ok || !profile.email_verified) {
      throw new Error('Could not verify the Google account email.');
    }

    let user = await findUserByGoogleId(profile.sub);
    if (!user) {
      const existing = await findUserByEmail(profile.email);
      user = existing ? await linkGoogleId(existing.id, profile.sub) : null;
    }
    if (!user) {
      const username = await generateUsernameFromEmail(profile.email);
      user = await createGoogleUser({ username, email: profile.email, googleId: profile.sub });
    }

    const exchangeToken = issueLoginExchangeToken(user.id);
    const redirectTo = `${CLIENT_APP_URL}?loginToken=${exchangeToken}`;
    console.log('google callback success, redirecting', { userId: user.id, redirectTo });
    res.redirect(redirectTo);
  } catch (err) {
    console.error('google auth error', err.message);
    res.redirect(`${CLIENT_APP_URL}?authError=google`);
  }
});

// The frontend calls this immediately on load when it sees ?loginToken= in
// the URL — see the comment on PENDING_LOGIN_EXCHANGES above for why the
// session cookie is set here, via a normal fetch(), rather than directly on
// the /google/callback redirect.
router.post('/google/exchange', async (req, res) => {
  const { token } = req.body || {};
  const userId = typeof token === 'string' ? consumeLoginExchangeToken(token) : null;
  if (!userId) {
    console.error('google exchange error: invalid or expired token', {
      hasToken: typeof token === 'string' && token.length > 0,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
    });
    return res.status(400).json({ error: 'This sign-in link has expired. Please try again.' });
  }
  try {
    const user = await findUserById(userId);
    if (!user) {
      console.error('google exchange error: token valid but user missing', { userId });
      return res.status(400).json({ error: 'This sign-in link has expired. Please try again.' });
    }
    const sessionToken = signToken(user.id);
    res.cookie(COOKIE_NAME, sessionToken, COOKIE_OPTIONS);
    console.log('google exchange success', { userId: user.id, origin: req.headers.origin });
    res.json({ user: toPublicUser(user), token: sessionToken });
  } catch (err) {
    console.error('google exchange error', err.message);
    res.status(500).json({ error: 'Something went wrong signing you in.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.userId);
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error('me error', err.message);
    res.status(500).json({ error: 'Something went wrong loading your account.' });
  }
});

router.post('/username', requireAuth, async (req, res) => {
  const { username } = req.body || {};
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-24 characters (letters, numbers, underscore).' });
  }
  try {
    const existing = await findUserByUsername(username);
    if (existing && existing.id !== req.userId) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    const user = await updateUsername(req.userId, username);
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    console.error('update username error', err.message);
    res.status(500).json({ error: 'Something went wrong updating your username.' });
  }
});

router.post('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  try {
    const user = await findUserById(req.userId);
    if (user.password_hash) {
      if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, user.password_hash))) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await updatePasswordHash(req.userId, passwordHash);
    res.json({ ok: true });
  } catch (err) {
    console.error('update password error', err.message);
    res.status(500).json({ error: 'Something went wrong updating your password.' });
  }
});

router.post('/delete', requireAuth, async (req, res) => {
  const { confirmUsername } = req.body || {};
  try {
    const user = await findUserById(req.userId);
    if (confirmUsername !== user.username) {
      return res.status(400).json({ error: 'Type your username exactly to confirm account deletion.' });
    }
    await deleteAccount(req.userId);
    res.clearCookie(COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
    res.json({ ok: true });
  } catch (err) {
    console.error('delete account error', err.message);
    res.status(500).json({ error: 'Something went wrong deleting your account.' });
  }
});

export default router;
