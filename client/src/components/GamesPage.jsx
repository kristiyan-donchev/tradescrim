import { lazy, Suspense, useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { fetchGameResults } from '../lib/api.js';
import { GAMES_META } from '../lib/games.js';
import GamesLeaderboard from './GamesLeaderboard.jsx';

// Lazy-loaded so picking one game doesn't pull in the other eight — most of
// these are only ever touched by a player who opens that specific card, and
// several pull in recharts-adjacent chart logic that's otherwise dead weight
// in the main bundle for anyone who never visits Games at all.
const GAME_COMPONENTS = {
  'market-crash': lazy(() => import('./MarketCrashGame.jsx')),
  'speed-round': lazy(() => import('./SpeedRoundGame.jsx')),
  'guess-the-chart': lazy(() => import('./GuessTheChartGame.jsx')),
  'build-a-portfolio': lazy(() => import('./BuildPortfolioGame.jsx')),
  'bull-or-bear': lazy(() => import('./BullBearGame.jsx')),
  'ticker-match': lazy(() => import('./TickerMatchGame.jsx')),
  'buy-the-dip': lazy(() => import('./BuyTheDipGame.jsx')),
  'investor-quiz': lazy(() => import('./InvestorQuizGame.jsx')),
  'candlestick-pattern': lazy(() => import('./CandlestickGame.jsx')),
};

export default function GamesPage({ guest, onRequestLogin }) {
  const [view, setView] = useState('play'); // 'play' | 'leaderboard'
  const [activeGameId, setActiveGameId] = useState(null);
  const [results, setResults] = useState([]);

  function refreshResults() {
    if (guest) return;
    fetchGameResults()
      .then(setResults)
      .catch(() => {});
  }

  useEffect(refreshResults, [guest]);

  const activeGame = GAMES_META.find((g) => g.id === activeGameId);

  if (activeGame) {
    const ActiveComponent = GAME_COMPONENTS[activeGame.id];
    return (
      <Suspense fallback={<p className="empty-state">Loading {activeGame.title}…</p>}>
        <ActiveComponent
          guest={guest}
          onRequestLogin={onRequestLogin}
          onExit={() => setActiveGameId(null)}
          onScoreSaved={refreshResults}
        />
      </Suspense>
    );
  }

  return (
    <>
      <div className="range-tabs category-tabs">
        <button type="button" className={view === 'play' ? 'range-tab active' : 'range-tab'} onClick={() => setView('play')}>
          Play
        </button>
        <button
          type="button"
          className={view === 'leaderboard' ? 'range-tab active' : 'range-tab'}
          onClick={() => setView('leaderboard')}
        >
          Leaderboards
        </button>
      </div>

      {view === 'leaderboard' ? (
        <GamesLeaderboard guest={guest} />
      ) : (
        <div className="games-grid">
          {GAMES_META.map((game) => {
            const best = results.find((r) => r.gameId === game.id);
            return (
              <button type="button" key={game.id} className="game-card" onClick={() => setActiveGameId(game.id)}>
                <span className="game-card-icon">
                  <Icon name={game.icon} size={26} />
                </span>
                <span className="game-card-title">{game.title}</span>
                <span className="game-card-desc">{game.description}</span>
                {!guest && best && (
                  <span className="game-card-best">
                    <Icon name="trophy" size={12} /> {game.scoreLabel}: {game.formatScore(best.bestScore)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
