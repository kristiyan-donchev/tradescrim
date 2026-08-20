import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Onboarding from './Onboarding.jsx';
import AdSlot from './AdSlot.jsx';
import LoadingScreen from './LoadingScreen.jsx';
import GuestGate from './GuestGate.jsx';
import AchievementToastHost from './AchievementToastHost.jsx';
import VerifyEmailBanner from './VerifyEmailBanner.jsx';
import { usePortfolio } from '../hooks/usePortfolio.js';
import { fetchQuote } from '../lib/api.js';

// Lazy-loaded per page (same reasoning as GamesPage's per-game split): only
// the page someone is actually looking at needs to be downloaded. This
// matters most for DashboardPage, which pulls in recharts — previously that
// shipped in the same entry bundle as the login screen, so even a guest who
// hadn't logged in yet paid for the app's single heaviest dependency before
// seeing anything at all.
const DashboardPage = lazy(() => import('./DashboardPage.jsx'));
const LeaderboardPage = lazy(() => import('./LeaderboardPage.jsx'));
const WatchlistPage = lazy(() => import('./WatchlistPage.jsx'));
const LearnPage = lazy(() => import('./LearnPage.jsx'));
const FriendsPage = lazy(() => import('./FriendsPage.jsx'));
const ChallengesPage = lazy(() => import('./ChallengesPage.jsx'));
const NewsPage = lazy(() => import('./NewsPage.jsx'));
const GamesPage = lazy(() => import('./GamesPage.jsx'));

const QUOTE_REFRESH_MS = 20000;

const PAGE_META = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Practice trading with real market prices — using 100% virtual money.',
  },
  leaderboard: {
    title: 'Leaderboard',
    subtitle: 'See how your portfolio return compares to other traders.',
  },
  watchlist: {
    title: 'Watchlist',
    subtitle: 'Track symbols you care about and get notified when they hit your price.',
  },
  news: {
    title: 'News',
    subtitle: 'Latest headlines from the markets.',
  },
  learn: {
    title: 'Learn',
    subtitle: 'Beginner-friendly explanations of how investing and this simulator work.',
  },
  games: {
    title: 'Games',
    subtitle: 'Quick, playable ways to sharpen your market instincts.',
  },
  friends: {
    title: 'Friends',
    subtitle: 'Add friends to compare portfolios and challenge each other.',
  },
  challenges: {
    title: 'Challenges',
    subtitle: 'Time-boxed ROI competitions with your friends — badges for participating and winning.',
  },
};

const GUEST_GATED_PAGES = {
  watchlist: {
    title: 'Log in to build a watchlist',
    description: 'Track symbols you care about and get notified when they hit your price.',
  },
  friends: {
    title: 'Log in to add friends',
    description: 'Add friends to compare portfolios and challenge each other.',
  },
  challenges: {
    title: 'Log in to join challenges',
    description: 'Time-boxed ROI competitions with your friends — badges for participating and winning.',
  },
};

export default function TradingApp({ guest = false, onRequestLogin, page, setPage } = {}) {
  const { state, loading, buy, sell, reset, error } = usePortfolio();
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [quoteError, setQuoteError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const symbolsToTrack = Array.from(
    new Set([...Object.keys(state.holdings), ...(selectedSymbol ? [selectedSymbol] : [])])
  );

  const refreshQuotes = useCallback(async (symbols) => {
    if (symbols.length === 0) return;
    const results = await Promise.allSettled(symbols.map((s) => fetchQuote(s)));
    setQuotes((prev) => {
      const next = { ...prev };
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[symbols[i]] = r.value;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    refreshQuotes(symbolsToTrack);
    const interval = setInterval(() => refreshQuotes(symbolsToTrack), QUOTE_REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsToTrack.join(','), refreshQuotes]);

  // The app is a single-page client-side "router" (no real per-page URLs),
  // so the tab title otherwise never changes from the static one in
  // index.html — this at least keeps browser tabs/history/bookmarks
  // reflecting where the user actually is.
  useEffect(() => {
    const meta = PAGE_META[page];
    document.title = meta ? `${meta.title} — TradeScrim` : 'TradeScrim — Paper Trading Simulator';
  }, [page]);

  function handleSelect(symbol, name) {
    setQuoteError(null);
    setSelectedSymbol(symbol);
    fetchQuote(symbol)
      .then((q) => setQuotes((prev) => ({ ...prev, [symbol]: q })))
      .catch((err) => setQuoteError(err.message));
  }

  // Selecting a watched symbol should jump to the Dashboard, since that's
  // where the quote, chart, and trade panel actually live.
  function handleSelectFromWatchlist(symbol, name) {
    handleSelect(symbol, name);
    setPage('dashboard');
  }

  function closeHelp() {
    setShowHelp(false);
  }

  async function handleReset() {
    if (window.confirm('This will erase your virtual cash, holdings, and transaction history. Continue?')) {
      await reset();
      setSelectedSymbol(null);
      setQuotes({});
    }
  }

  if (loading) {
    return <LoadingScreen label="Loading your portfolio" />;
  }

  const holdingsValue = Object.values(state.holdings).reduce((sum, h) => {
    const q = quotes[h.symbol];
    return sum + (q ? q.price * h.shares : h.avgCost * h.shares);
  }, 0);

  const selectedQuote = selectedSymbol ? quotes[selectedSymbol] : null;
  const selectedHolding = selectedSymbol ? state.holdings[selectedSymbol] : null;
  const meta = PAGE_META[page];

  return (
    <>
      {!guest && <VerifyEmailBanner />}
      <div className="app-shell">
        {showHelp && <Onboarding onClose={closeHelp} />}

        <AchievementToastHost guest={guest} />

      <Sidebar
        page={page}
        onNavigate={setPage}
        onShowHelp={() => setShowHelp(true)}
        onReset={handleReset}
        guest={guest}
        onRequestLogin={onRequestLogin}
      />

      <main className="main-content">
        <div className="main-layout">
          <div className="page-column">
            <div className="page-header">
              <h1>{meta.title}</h1>
              <p className="tagline">{meta.subtitle}</p>
            </div>

            <div className="page-content">
              <Suspense fallback={<p className="empty-state">Loading…</p>}>
                {page === 'dashboard' && (
                  <DashboardPage
                    state={state}
                    holdingsValue={holdingsValue}
                    quotes={quotes}
                    quoteError={quoteError}
                    selectedSymbol={selectedSymbol}
                    selectedQuote={selectedQuote}
                    selectedHolding={selectedHolding}
                    onSelect={handleSelect}
                    buy={buy}
                    sell={sell}
                    error={error}
                    guest={guest}
                    onRequestLogin={onRequestLogin}
                  />
                )}
                {page === 'leaderboard' && <LeaderboardPage />}
                {page === 'learn' && <LearnPage />}
                {page === 'news' && <NewsPage />}
                {page === 'games' && <GamesPage guest={guest} onRequestLogin={onRequestLogin} />}
                {guest && GUEST_GATED_PAGES[page] && (
                  <GuestGate onRequestLogin={onRequestLogin} {...GUEST_GATED_PAGES[page]} />
                )}
                {!guest && page === 'watchlist' && <WatchlistPage onSelectSymbol={handleSelectFromWatchlist} />}
                {!guest && page === 'friends' && <FriendsPage />}
                {!guest && page === 'challenges' && <ChallengesPage />}
              </Suspense>
            </div>

            <footer className="app-footer">
              TradeScrim is an educational paper-trading simulator. It is not a brokerage, does not
              execute real trades, and is not financial advice.
            </footer>
          </div>

          <aside className="ad-rail" aria-label="Advertisement">
            <AdSlot />
          </aside>
        </div>
      </main>
      </div>
    </>
  );
}
