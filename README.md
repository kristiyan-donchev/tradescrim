# TradeScrim

A beginner-friendly **paper-trading simulator** for learning how stock investing works — using real,
delayed market prices and **100% virtual money**.

> ⚠️ **This is an educational simulator only.** There is no real money, no real brokerage account,
> and no real orders are ever placed. Nothing in this app can move, invest, or risk actual funds.
> It exists purely to help beginners practice the mechanics of researching and "trading" stocks
> in a risk-free environment. Nothing here is financial advice.

## What it does

- **Real user accounts.** Sign up with a username, email, and password, then log in/out. Each
  account gets its own portfolio — see [Accounts & auth](#accounts--auth) below.
- Gives every new account **$10,000 in virtual cash** to start.
- Lets you **search real ticker symbols** (e.g. `AAPL`, `MSFT`, `TSLA`) by company name or symbol.
- Shows the **current price** and a **recent price history chart** (1 day up to 1 year) for any
  stock, pulled live from Yahoo Finance.
- Lets you place simulated **market buy/sell orders** at the live price.
- Tracks your **portfolio**: current holdings, average cost basis, live market value, unrealized
  P&L per holding, and total/realized P&L.
- Keeps a full **transaction history** log of every simulated trade.
- Includes **plain-language explanations** (via hover/tap tooltips and an onboarding "Help" panel)
  for beginner terms like *market order*, *P&L*, *cost basis*, *diversification*, *ticker symbol*,
  and *volatility*.
- **Persists per-account server-side** in a Postgres database — each user's cash, holdings, and
  transaction history are scoped to their account.
- **Deployable**, not just local-only: the frontend and backend are split so you can host them on
  separate services (e.g. GitHub Pages + Render + a hosted Postgres) — see
  [Deploying to production](#deploying-to-production).

## Accounts & auth

- **Sign up / log in / log out** with a username, email, and password, or **continue with Google**.
  Passwords are hashed with **bcrypt** (via `bcryptjs`) before being stored — plaintext passwords are
  never saved. Google accounts have no password on file at all.
- Google sign-in uses the standard OAuth 2.0 authorization-code flow, run entirely server-side: the
  backend redirects to Google, exchanges the returned code for the user's verified email, then
  creates an account (or links to an existing password-based account with the same email) and issues
  the same session cookie as the password flow. See `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` /
  `GOOGLE_REDIRECT_URI` in `server/.env.example` — the button is hidden behind a 500 if these aren't
  set, so Google sign-in is entirely optional.
- Sessions are handled with a **JWT stored in an `httpOnly` cookie** (not `localStorage`, to reduce
  XSS exposure). The API's portfolio routes are protected by auth middleware that checks this
  cookie and only ever reads/writes the requesting user's own data.
- Every new account starts with **$10,000 in virtual cash** and an empty portfolio — there is no
  migration path from the old browser-`localStorage`-only version, so upgrading from an older copy
  of this app means starting fresh under a new account. That's expected and fine for a learning
  tool.
- **Security caveats (read before relying on this for anything beyond personal/hobby use):**
  - This app **has not had a professional security audit**. It's built with reasonable defaults
    (hashed passwords, httpOnly cookies, per-user scoped queries) but that's not the same as a
    vetted, production-hardened multi-tenant service — don't put real sensitive data behind it.
  - There is **no email verification** and **no password reset flow** — if a user forgets their
    password, there's no recovery path other than querying the Postgres database directly.
  - Login, signup, and verification-resend are **rate-limited per IP** (see `server/src/routes/auth.js`),
    but there is still no account lockout, no CAPTCHA/bot protection on signup, and no CSRF protection
    beyond the cookie's `SameSite` setting.
  - The JWT signing secret (`JWT_SECRET`) **must** be set via `.env` for stable sessions in any
    real deployment; if left unset the server generates a random one at startup, which invalidates
    all sessions on every restart (see [Setup & running locally](#setup--running-locally)).
  - If you deploy this publicly, treat it as a **portfolio/demo project**, not a service handling
    money or sensitive personal data for strangers.

## Tech stack

- **Frontend:** React 18 + Vite, plain CSS (light/dark aware), [Recharts](https://recharts.org/) for
  the price chart. A small `AuthContext` handles the logged-in user and gates the trading UI behind
  a login/signup screen.
- **Backend:** a small Node.js + Express server that proxies market-data requests to
  [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2) (an unofficial, free,
  no-API-key-required wrapper around Yahoo Finance's public data), plus auth (`bcryptjs` +
  `jsonwebtoken` + `cookie-parser`) and per-user portfolio routes. The market-data proxy also avoids
  CORS issues calling Yahoo Finance directly from the browser.
- **Persistence:** Postgres, accessed via [`node-postgres`](https://node-postgres.com/) (`pg`).
  Works with any Postgres instance — a local install, or a free hosted database on
  [Neon](https://neon.tech) or [Supabase](https://supabase.com) for zero-setup dev/production.
  Stores `users`, `holdings`, and `transactions` tables scoped by `user_id`; the schema is created
  automatically on server startup.

## Project structure

```
tradescrim/
├── server/
│   └── src/
│       ├── routes/            # /api/search, /api/quote/:symbol, /api/history/:symbol,
│       │                      # /api/auth/*, /api/portfolio/*
│       ├── middleware/auth.js # JWT-cookie auth guard for portfolio routes
│       ├── lib/                # users.js, portfolio.js (DB access), jwt.js
│       └── db.js              # Postgres connection pool + schema setup
└── client/     # React + Vite frontend
```

## Setup & running locally

Requires [Node.js](https://nodejs.org/) **18+** and npm, plus a Postgres database (see step 2).

**1. Install dependencies (in two terminals, or sequentially):**

```bash
cd server && npm install
cd ../client && npm install
```

**2. Get a Postgres database.** Either:

- **Local Postgres** — if you already have it installed, create an empty database and use its
  connection string, or
- **Free hosted Postgres (recommended, zero local setup)** — create a free project/database at
  [Neon](https://neon.tech) or [Supabase](https://supabase.com) and copy the connection string they
  give you (it looks like `postgres://user:password@host/dbname?sslmode=require`). This works fine
  for local development too, not just production.

**3. Configure the server's environment:**

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and set:
- `DATABASE_URL` to the connection string from step 2 — **required**, the server refuses to start
  without it.
- `JWT_SECRET` to a long random string (used to sign login sessions). If you skip this, the server
  still runs — it just generates a random secret at startup, which logs everyone out whenever the
  server restarts.

**4. Run the backend (API + auth + market-data proxy), from `server/`:**

```bash
npm run dev
```

This starts the API on `http://localhost:4000` and creates the `users`/`holdings`/`transactions`
tables in your Postgres database automatically on first run.

**5. Run the frontend, from `client/`:**

```bash
npm run dev
```

This starts the Vite dev server on `http://localhost:5173` (it proxies `/api/*` requests to the
backend on port 4000, so both need to be running). Open that URL in your browser.

## Deploying to production

The app is split into three independently-deployable pieces: a Postgres database, the Express API,
and the static React build. A working free-tier combination:

**1. Database — [Neon](https://neon.tech) or [Supabase](https://supabase.com).** Create a project,
copy the connection string. This is your `DATABASE_URL`.

**2. Backend — [Render](https://render.com), [Railway](https://railway.app), or
[Fly.io](https://fly.io).** Deploy the `server/` directory as a Node web service:
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `DATABASE_URL` (from step 1), `JWT_SECRET` (a long random string —
  generate one with e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`),
  `NODE_ENV=production`, and `CLIENT_ORIGIN` set to your custom domain (step 3), e.g.
  `https://tradescrim.com`. Add `FINNHUB_API_KEY` (a free key from
  [finnhub.io/register](https://finnhub.io/register)) to power the News tab and the Bull or Bear
  game — without it, News shows an error and Bull or Bear can't load rounds. Optionally add
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` (see
  [Accounts & auth](#accounts--auth)) to enable "Continue with Google" — `GOOGLE_REDIRECT_URI` must
  be this backend's own public URL plus `/api/auth/google/callback`, and must be added as an
  "Authorized redirect URI" on the Google OAuth client in
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials). `CLIENT_APP_URL` isn't
  needed here — it exists only for the case where the post-login redirect target differs from the
  bare `CLIENT_ORIGIN`, which doesn't apply once the frontend is served from its own domain's root.
- Note the backend's public URL (e.g. `https://tradescrim-api.onrender.com`) — you'll need it in
  step 3.

**3. Frontend — [GitHub Pages](https://pages.github.com/) with a custom domain.** A workflow at
`.github/workflows/deploy-pages.yml` builds `client/` and deploys it automatically on every push to
`master` that touches `client/**`. One-time setup:
- In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
- In **Settings → Secrets and variables → Actions → Variables**, add a repository variable
  `VITE_API_BASE_URL` set to the backend URL from step 2 (e.g.
  `https://tradescrim-api.onrender.com`) — the workflow bakes this into the build.
- Push to `master` (or run the workflow manually from the **Actions** tab) to trigger the first
  deploy.
- **Point your registered domain at it:** in **Settings → Pages → Custom domain**, enter your domain
  (e.g. `tradescrim.com`) and follow GitHub's DNS instructions (an `A`/`ALIAS` record at your apex
  domain, or a `CNAME` record for a `www` subdomain, pointing at GitHub Pages). GitHub will commit a
  `CNAME` file to the Pages deployment for you the first time you save this setting. `vite.config.js`
  already builds with `base: '/'`, since the app is served from the domain's root rather than a
  `github.io/<repo>` subpath.
- Once your domain is live, go back to your backend's environment variables and confirm
  `CLIENT_ORIGIN` matches it exactly, then redeploy the backend so CORS/cookies allow it.

(Vercel or Netlify work too, if you'd rather not use GitHub Pages — same build command `npm run
build`, output directory `dist`, and `VITE_API_BASE_URL` env var.)

Because the frontend and backend end up on different domains, the login cookie is issued with
`SameSite=None; Secure` in production (see `server/src/routes/auth.js`) — this requires both sides
to be served over **HTTPS**, which all of the platforms above provide by default.

**Local build preview** (frontend only, without deploying):

```bash
cd client && npm run build && npm run preview
```

## Limitations

- **Data delay:** Yahoo Finance quotes are typically delayed ~15 minutes for most exchanges (this
  is standard for free market data). This app is for practice and learning, not real-time trading.
- **Unofficial data source:** `yahoo-finance2` is an unofficial community library that scrapes
  Yahoo Finance's public endpoints. Yahoo can change or restrict these endpoints at any time without
  notice, which could occasionally cause quote/search/chart requests to fail or need library updates.
- **Market hours:** outside of regular market hours, "current price" reflects the last available
  quote (pre-market/after-hours/previous close), which the UI labels via the market state shown
  next to the price.
- **Rate limits:** the free Yahoo Finance data source has informal rate limits. Heavy, rapid-fire
  searching/quoting could occasionally get temporarily throttled.
- **Accounts are real but not production-hardened:** see [Accounts & auth](#accounts--auth) above —
  no email verification, no password reset, no CAPTCHA/bot protection on signup. Fine for personal
  use or a portfolio demo; not vetted for handling a large public user base. Use the in-app "Reset
  simulator" button if you want to intentionally wipe your own portfolio and start over.
- Market, limit, stop, and stop-limit orders are supported — no options, short selling, margin,
  dividends, or fees/commissions are modeled. This keeps the simulator focused on core buy/sell/P&L
  mechanics for beginners.

## Disclaimer

TradeScrim is provided for **educational purposes only**. It is not a broker-dealer, does
not handle real money or securities, and nothing in this app constitutes financial, investment, or
trading advice. Simulated results do not guarantee or predict real-world investing outcomes.
