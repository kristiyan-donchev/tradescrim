import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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
  findUserByVerificationToken,
  markEmailVerified,
  setEmailVerificationToken,
} from '../lib/users.js';
import { sendVerificationEmail } from '../lib/email.js';
import { signToken, COOKIE_NAME } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const IS_PROD = process.env.NODE_ENV === 'production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0];
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
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

// A handful of the passwords that show up at the top of every leaked-password
// frequency list — these pass a naive "8+ chars, letter + number" check
// (e.g. "password1") but offer essentially zero real protection. Blocking
// this short, well-known list catches the overwhelming majority of
// zero-effort passwords without the UX cost of a full entropy scorer.
const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyuiop', 'letmein123', 'welcome123', 'iloveyou1', 'admin1234',
  'trustno1', '87654321', 'abc123456', 'football1', 'baseball1', 'dragon123',
  'monkey123', 'sunshine1', 'princess1', 'starwars1',
]);

// Length + a mix of character types is a much stronger, still-simple bar
// than length alone, and rejecting known-common passwords catches the
// "technically meets the rule" weak passwords that mix requirement misses.
function passwordStrengthError(password) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return 'That password is too common — please choose a less predictable one.';
  }
  return null;
}

// Per-IP limits on the two endpoints that create sessions or accounts from
// arbitrary, unauthenticated input — the ones a bot can hit in a loop.
// Signup is capped tighter than login since there's rarely a legitimate
// reason for one IP to create many accounts, while login needs enough
// headroom for a real person mistyping their password a few times.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this network. Try again in a bit.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
});

router.post('/signup', signupLimiter, async (req, res) => {
  const { username, email, password } = req.body || {};

  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-24 characters (letters, numbers, underscore).' });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required.' });
  }
  const passwordError = passwordStrengthError(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    if (await findUserByUsername(username)) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    if (await findUserByEmail(email)) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const user = await createUser({
      username,
      email,
      passwordHash,
      verificationToken,
      verificationExpiresAt: Date.now() + VERIFICATION_TOKEN_TTL_MS,
    });

    // Signup succeeds even if the email fails to send (e.g. RESEND_API_KEY
    // missing, or Resend itself down) — losing verification email delivery
    // shouldn't lock a new user out of the account they just created. They
    // can retry via the resend-verification endpoint once email is working.
    // The link points at this backend's own /verify-email route (derived
    // from the incoming request, same trick used nowhere else in this file
    // since GOOGLE_REDIRECT_URI is pre-configured for the OAuth case but
    // that env var is optional and shouldn't be a hard dependency here).
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;
    sendVerificationEmail(email, verifyUrl).catch((err) => {
      console.error('signup: failed to send verification email', err.message);
    });

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

router.post('/login', loginLimiter, async (req, res) => {
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

// Plain link click from an email client, not a fetch() — so this responds
// with a redirect back to the app rather than JSON, same reasoning as the
// Google OAuth callback below.
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (typeof token !== 'string') {
    return res.redirect(`${CLIENT_APP_URL}?emailVerified=0`);
  }
  try {
    const user = await findUserByVerificationToken(token);
    if (!user || Number(user.email_verification_expires_at) < Date.now()) {
      return res.redirect(`${CLIENT_APP_URL}?emailVerified=0`);
    }
    await markEmailVerified(user.id);
    res.redirect(`${CLIENT_APP_URL}?emailVerified=1`);
  } catch (err) {
    console.error('verify-email error', err.message);
    res.redirect(`${CLIENT_APP_URL}?emailVerified=0`);
  }
});

const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in a few minutes.' },
});

router.post('/resend-verification', requireAuth, resendVerificationLimiter, async (req, res) => {
  try {
    const user = await findUserById(req.userId);
    if (!user.password_hash) {
      return res.status(400).json({ error: 'Google accounts are already verified.' });
    }
    if (user.email_verified) {
      return res.status(400).json({ error: 'This email is already verified.' });
    }
    const verificationToken = crypto.randomBytes(24).toString('hex');
    await setEmailVerificationToken(user.id, verificationToken, Date.now() + VERIFICATION_TOKEN_TTL_MS);
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(user.email, verifyUrl);
    res.json({ ok: true });
  } catch (err) {
    console.error('resend-verification error', err.message);
    res.status(500).json({ error: 'Could not send a new verification email right now.' });
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
  if (typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'New password is required.' });
  }
  const passwordError = passwordStrengthError(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
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
