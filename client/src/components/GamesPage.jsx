import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { fetchGameResults } from '../lib/api.js';
import { GAMES_META } from '../lib/games.js';
import GamesLeaderboard from './GamesLeaderboard.jsx';
import MarketCrashGame from './MarketCrashGame.jsx';
import SpeedRoundGame from './SpeedRoundGame.jsx';
import GuessTheChartGame from './GuessTheChartGame.jsx';
import BuildPortfolioGame from './BuildPortfolioGame.jsx';
import BullBearGame from './BullBearGame.jsx';
import TickerMatchGame from './TickerMatchGame.jsx';
import BuyTheDipGame from './BuyTheDipGame.jsx';
import InvestorQuizGame from './InvestorQuizGame.jsx';
import CandlestickGame from './CandlestickGame.jsx';

const GAME_COMPONENTS = {
  'market-crash': MarketCrashGame,
  'speed-round': SpeedRoundGame,
  'guess-the-chart': GuessTheChartGame,
  'build-a-portfolio': BuildPortfolioGame,
  'bull-or-bear': BullBearGame,
  'ticker-match': TickerMatchGame,
  'buy-the-dip': BuyTheDipGame,
  'investor-quiz': InvestorQuizGame,
  'candlestick-pattern': CandlestickGame,
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
      <ActiveComponent
        guest={guest}
        onRequestLogin={onRequestLogin}
        onExit={() => setActiveGameId(null)}
        onScoreSaved={refreshResults}
      />
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
