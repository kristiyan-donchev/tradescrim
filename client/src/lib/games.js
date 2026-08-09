// Static metadata for each game — shared between GamesPage (which also maps
// each id to its React component) and GamesLeaderboard (which only needs the
// display bits, not the component).
export const GAMES_META = [
  {
    id: 'market-crash',
    title: 'Market Crash Simulator',
    icon: 'trending-down',
    description: "A crash is unfolding in real time. Buy the dip, hold, sell, or hedge at each turn, then see how your calls played out.",
    scoreLabel: 'best return',
    formatScore: (n) => `${n > 0 ? '+' : ''}${n}%`,
  },
  {
    id: 'speed-round',
    title: 'Speed Round Trivia',
    icon: 'zap',
    description: 'Rapid-fire market trivia against the clock. How many can you answer correctly in 60 seconds?',
    scoreLabel: 'best score',
    formatScore: (n) => n,
  },
  {
    id: 'guess-the-chart',
    title: 'Guess the Chart',
    icon: 'bar-chart',
    description: 'Two real 3-month price charts, symbols hidden. Pick the one with the better return, and keep your streak alive.',
    scoreLabel: 'best streak',
    formatScore: (n) => n,
  },
  {
    id: 'build-a-portfolio',
    title: 'Build a Portfolio',
    icon: 'grid',
    description: 'Allocate a fixed budget across assets with different risk profiles to hit a diversification target.',
    scoreLabel: 'best score',
    formatScore: (n) => `${n}/100`,
  },
  {
    id: 'bull-or-bear',
    title: 'Bull or Bear',
    icon: 'scale',
    description: "A real headline pulled from today's market news. Guess whether the stock it's about went up or down.",
    scoreLabel: 'best streak',
    formatScore: (n) => n,
  },
];
