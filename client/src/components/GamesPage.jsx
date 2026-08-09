import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { fetchGameResults } from '../lib/api.js';
import MarketCrashGame from './MarketCrashGame.jsx';
import SpeedRoundGame from './SpeedRoundGame.jsx';
import GuessTheChartGame from './GuessTheChartGame.jsx';
import BuildPortfolioGame from './BuildPortfolioGame.jsx';
import BullBearGame from './BullBearGame.jsx';

const GAMES = [
  {
    id: 'market-crash',
    title: 'Market Crash Simulator',
    icon: 'trending-down',
    description: "A crash is unfolding in real time. Buy the dip, hold, sell, or hedge at each turn, then see how your calls played out.",
    Component: MarketCrashGame,
    scoreLabel: 'best return',
    formatScore: (n) => `${n > 0 ? '+' : ''}${n}%`,
  },
  {
    id: 'speed-round',
    title: 'Speed Round Trivia',
    icon: 'zap',
    description: 'Rapid-fire market trivia against the clock. How many can you answer correctly in 60 seconds?',
    Component: SpeedRoundGame,
    scoreLabel: 'best score',
    formatScore: (n) => n,
  },
  {
    id: 'guess-the-chart',
    title: 'Guess the Chart',
    icon: 'bar-chart',
    description: 'Two real 3-month price charts, symbols hidden. Pick the one with the better return, and keep your streak alive.',
    Component: GuessTheChartGame,
    scoreLabel: 'best streak',
    formatScore: (n) => n,
  },
  {
    id: 'build-a-portfolio',
    title: 'Build a Portfolio',
    icon: 'grid',
    description: 'Allocate a fixed budget across assets with different risk profiles to hit a diversification target.',
    Component: BuildPortfolioGame,
    scoreLabel: 'best score',
    formatScore: (n) => `${n}/100`,
  },
  {
    id: 'bull-or-bear',
    title: 'Bull or Bear',
    icon: 'scale',
    description: "A real headline pulled from today's market news. Guess whether the stock it's about went up or down.",
    Component: BullBearGame,
    scoreLabel: 'best streak',
    formatScore: (n) => n,
  },
];

export default function GamesPage({ guest, onRequestLogin }) {
  const [activeGameId, setActiveGameId] = useState(null);
  const [results, setResults] = useState([]);

  function refreshResults() {
    if (guest) return;
    fetchGameResults()
      .then(setResults)
      .catch(() => {});
  }

  useEffect(refreshResults, [guest]);

  const activeGame = GAMES.find((g) => g.id === activeGameId);

  if (activeGame) {
    const ActiveComponent = activeGame.Component;
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
    <div className="games-grid">
      {GAMES.map((game) => {
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
  );
}
