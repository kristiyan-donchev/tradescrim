// In local dev this stays relative and Vite's dev proxy forwards it to the API.
// In production, set VITE_API_BASE_URL to the deployed backend's origin, since
// the frontend and backend are typically hosted on different domains.
const BASE = `${import.meta.env.VITE_API_BASE_URL || ''}/api`;

// Google sign-in is a full-page redirect (not a fetch), so the backend can run
// the OAuth code exchange server-side and set the session cookie before
// bouncing back to the frontend.
export const GOOGLE_AUTH_URL = `${BASE}/auth/google`;

async function getJson(url) {
  const res = await fetch(url, { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

async function deleteJson(url) {
  const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

export function searchSymbols(query) {
  return getJson(`${BASE}/search?q=${encodeURIComponent(query)}`).then((d) => d.results || []);
}

export function fetchQuote(symbol) {
  return getJson(`${BASE}/quote/${encodeURIComponent(symbol)}`);
}

export function fetchMarketNews() {
  return getJson(`${BASE}/news`).then((d) => d.news || []);
}

export function fetchHistory(symbol, range = '1mo') {
  return getJson(`${BASE}/history/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}`).then(
    (d) => d.points || []
  );
}

// The backend also sets an httpOnly session cookie itself on every response
// below, which is enough on its own for local dev (same-origin) and most
// browsers in production. But real-device testing found iOS Safari refusing
// to persist ANY cookie set by api.tradescrim.com via a network response —
// not just on the redirect back from Google, but even on an immediate
// same-page fetch() with no navigation involved — almost certainly because
// that subdomain has never been visited as a first-party top-level page.
// Writing the cookie via document.cookie here instead is a first-party
// write on tradescrim.com itself, which sidesteps that restriction entirely
// regardless of which API endpoint issued the token. Only runs in production
// (VITE_API_BASE_URL set) — local dev is same-origin and doesn't need it.
// Trade-off: this cookie can no longer be httpOnly, since JS has to write
// it — a stored-XSS bug could now read the session token, which couldn't
// happen before. Kept in addition to (not instead of) the server's own
// cookie, since the server-set one still works fine in browsers other than
// Safari and is the more defensible default where it works.
const SESSION_COOKIE_NAME = 'tradescrim_token'; // must match COOKIE_NAME in server/src/lib/jwt.js
const SESSION_COOKIE_DOMAIN = '.tradescrim.com';
const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function persistSessionCookie(token) {
  if (!import.meta.env.VITE_API_BASE_URL || !token) return;
  document.cookie = `${SESSION_COOKIE_NAME}=${token}; Domain=${SESSION_COOKIE_DOMAIN}; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; Secure; SameSite=None`;
}

function clearSessionCookie() {
  if (!import.meta.env.VITE_API_BASE_URL) return;
  document.cookie = `${SESSION_COOKIE_NAME}=; Domain=${SESSION_COOKIE_DOMAIN}; Path=/; Max-Age=0; Secure; SameSite=None`;
}

export function signup({ username, email, password }) {
  return postJson(`${BASE}/auth/signup`, { username, email, password }).then((d) => {
    persistSessionCookie(d.token);
    return d.user;
  });
}

export function login({ username, password }) {
  return postJson(`${BASE}/auth/login`, { username, password }).then((d) => {
    persistSessionCookie(d.token);
    return d.user;
  });
}

// Trades a one-time token (from the ?loginToken= the Google callback redirects
// back with) for a real session — see the comment on PENDING_LOGIN_EXCHANGES
// in server/src/routes/auth.js for why the session cookie isn't set directly
// on that redirect.
export function exchangeGoogleLogin(token) {
  return postJson(`${BASE}/auth/google/exchange`, { token }).then((d) => {
    persistSessionCookie(d.token);
    return d.user;
  });
}

export function logout() {
  return postJson(`${BASE}/auth/logout`, {}).finally(clearSessionCookie);
}

export function fetchCurrentUser() {
  return getJson(`${BASE}/auth/me`).then((d) => d.user);
}

export function fetchPortfolio() {
  return getJson(`${BASE}/portfolio`);
}

export function buyShares(order) {
  return postJson(`${BASE}/portfolio/buy`, order);
}

export function sellShares(order) {
  return postJson(`${BASE}/portfolio/sell`, order);
}

export function resetPortfolio() {
  return postJson(`${BASE}/portfolio/reset`, {});
}

export function fetchPerformance(range = '1mo') {
  return getJson(`${BASE}/portfolio/performance?range=${encodeURIComponent(range)}`);
}

export function fetchLeaderboard(range = '1mo', category = 'return', scope = 'global') {
  return getJson(
    `${BASE}/portfolio/leaderboard?range=${encodeURIComponent(range)}&category=${encodeURIComponent(category)}&scope=${encodeURIComponent(scope)}`
  );
}

export function fetchWatchlist() {
  return getJson(`${BASE}/watchlist`).then((d) => d.watchlist || []);
}

export function addToWatchlist({ symbol, name }) {
  return postJson(`${BASE}/watchlist`, { symbol, name }).then((d) => d.watchlist || []);
}

export function removeFromWatchlist(symbol) {
  return deleteJson(`${BASE}/watchlist/${encodeURIComponent(symbol)}`).then((d) => d.watchlist || []);
}

export function fetchAlerts() {
  return getJson(`${BASE}/alerts`).then((d) => d.alerts || []);
}

export function fetchUnseenAlertCount() {
  return getJson(`${BASE}/alerts/unseen-count`).then((d) => d.count || 0);
}

export function createAlert({ symbol, name, direction, targetPrice }) {
  return postJson(`${BASE}/alerts`, { symbol, name, direction, targetPrice }).then((d) => d.alerts || []);
}

export function cancelAlert(id) {
  return deleteJson(`${BASE}/alerts/${id}`).then((d) => d.alerts || []);
}

export function fetchOrders() {
  return getJson(`${BASE}/orders`).then((d) => d.orders || []);
}

export function placeOrder(order) {
  return postJson(`${BASE}/orders`, order).then((d) => d.orders || []);
}

export function cancelOrder(id) {
  return postJson(`${BASE}/orders/${id}/cancel`, {}).then((d) => d.orders || []);
}

export function fetchAchievements() {
  return getJson(`${BASE}/achievements`).then((d) => d.achievements || []);
}

export function updateUsername(username) {
  return postJson(`${BASE}/auth/username`, { username }).then((d) => d.user);
}

export function updatePassword({ currentPassword, newPassword }) {
  return postJson(`${BASE}/auth/password`, { currentPassword, newPassword });
}

export function deleteAccount(confirmUsername) {
  return postJson(`${BASE}/auth/delete`, { confirmUsername }).finally(clearSessionCookie);
}

export function fetchFriends() {
  return getJson(`${BASE}/friends`);
}

export function fetchUnseenFriendRequestCount() {
  return getJson(`${BASE}/friends/unseen-count`).then((d) => d.count || 0);
}

export function sendFriendRequest(username) {
  return postJson(`${BASE}/friends/requests`, { username });
}

export function acceptFriendRequest(id) {
  return postJson(`${BASE}/friends/requests/${id}/accept`, {});
}

export function declineFriendRequest(id) {
  return deleteJson(`${BASE}/friends/requests/${id}`);
}

export function unfriend(userId) {
  return deleteJson(`${BASE}/friends/${userId}`);
}

export function fetchChallenges() {
  return getJson(`${BASE}/challenges`);
}

export function createChallenge({ title, description, durationDays }) {
  return postJson(`${BASE}/challenges`, { title, description, durationDays });
}

export function joinChallenge(id) {
  return postJson(`${BASE}/challenges/${id}/join`, {});
}

export function fetchChallengeStandings(id) {
  return getJson(`${BASE}/challenges/${id}/standings`);
}

export function fetchCompletedLessons() {
  return getJson(`${BASE}/lessons/completed`).then((d) => d.completed || []);
}

export function completeLesson(lessonId, firstTryPerfect) {
  return postJson(`${BASE}/lessons/${encodeURIComponent(lessonId)}/complete`, { firstTryPerfect }).then(
    (d) => d.completed || []
  );
}

export function fetchChartPair() {
  return getJson(`${BASE}/games/chart-pair`);
}

export function fetchBullBearRound() {
  return getJson(`${BASE}/games/bull-bear-round`);
}

export function fetchCandlestickRound() {
  return getJson(`${BASE}/games/candlestick-round`);
}

export function fetchGameResults() {
  return getJson(`${BASE}/games/results`).then((d) => d.results || []);
}

export function fetchGamesLeaderboard(gameId, scope = 'global') {
  return getJson(`${BASE}/games/leaderboard?gameId=${encodeURIComponent(gameId)}&scope=${scope}`).then(
    (d) => d.leaderboard || []
  );
}

export function submitGameResult(gameId, score, meta) {
  return postJson(`${BASE}/games/${encodeURIComponent(gameId)}/result`, { score, meta }).then(
    (d) => d.results || []
  );
}

export function fetchBugReports() {
  return getJson(`${BASE}/bugs`).then((d) => d.reports || []);
}

export function submitBugReport({ description, page }) {
  return postJson(`${BASE}/bugs`, { description, page }).then((d) => d.reports || []);
}
