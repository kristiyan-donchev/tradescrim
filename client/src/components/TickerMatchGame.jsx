import { useEffect, useMemo, useState } from 'react';
import GameShell from './GameShell.jsx';
import { Icon } from './icons.jsx';
import { submitGameResult } from '../lib/api.js';

// Well-known companies only — the point is recognizing the pairing, not
// obscure ticker trivia. The pool is much bigger than a single round needs
// so that which companies show up (not just their card positions) changes
// from one playthrough to the next.
const COMPANIES = [
  { ticker: 'AAPL', name: 'Apple' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'GOOGL', name: 'Alphabet (Google)' },
  { ticker: 'META', name: 'Meta' },
  { ticker: 'TSLA', name: 'Tesla' },
  { ticker: 'NFLX', name: 'Netflix' },
  { ticker: 'NVDA', name: 'NVIDIA' },
  { ticker: 'ORCL', name: 'Oracle' },
  { ticker: 'ADBE', name: 'Adobe' },
  { ticker: 'CRM', name: 'Salesforce' },
  { ticker: 'INTC', name: 'Intel' },
  { ticker: 'AMD', name: 'AMD' },
  { ticker: 'IBM', name: 'IBM' },
  { ticker: 'CSCO', name: 'Cisco' },
  { ticker: 'QCOM', name: 'Qualcomm' },
  { ticker: 'PYPL', name: 'PayPal' },
  { ticker: 'WMT', name: 'Walmart' },
  { ticker: 'TGT', name: 'Target' },
  { ticker: 'COST', name: 'Costco' },
  { ticker: 'HD', name: 'Home Depot' },
  { ticker: 'NKE', name: 'Nike' },
  { ticker: 'SBUX', name: 'Starbucks' },
  { ticker: 'MCD', name: "McDonald's" },
  { ticker: 'KO', name: 'Coca-Cola' },
  { ticker: 'PEP', name: 'PepsiCo' },
  { ticker: 'DIS', name: 'Disney' },
  { ticker: 'CMCSA', name: 'Comcast' },
  { ticker: 'F', name: 'Ford' },
  { ticker: 'GM', name: 'General Motors' },
  { ticker: 'JPM', name: 'JPMorgan Chase' },
  { ticker: 'BAC', name: 'Bank of America' },
  { ticker: 'V', name: 'Visa' },
  { ticker: 'MA', name: 'Mastercard' },
  { ticker: 'GS', name: 'Goldman Sachs' },
  { ticker: 'JNJ', name: 'Johnson & Johnson' },
  { ticker: 'PFE', name: 'Pfizer' },
  { ticker: 'UNH', name: 'UnitedHealth Group' },
  { ticker: 'DAL', name: 'Delta Air Lines' },
  { ticker: 'UAL', name: 'United Airlines' },
  { ticker: 'XOM', name: 'ExxonMobil' },
  { ticker: 'CVX', name: 'Chevron' },
  { ticker: 'T', name: 'AT&T' },
  { ticker: 'VZ', name: 'Verizon' },
];

// One round shows this many pairs — matches the 5-column grid (20 cards).
// The companies used are freshly sampled from the full pool each round.
const ROUND_SIZE = 10;

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDeck() {
  const roundCompanies = shuffle(COMPANIES).slice(0, ROUND_SIZE);
  const cards = roundCompanies.flatMap((c, pairId) => [
    { id: `${pairId}-ticker`, pairId, label: c.ticker },
    { id: `${pairId}-name`, pairId, label: c.name },
  ]);
  return shuffle(cards);
}

export default function TickerMatchGame({ guest, onExit, onScoreSaved }) {
  const [deck, setDeck] = useState(buildDeck);
  const [flipped, setFlipped] = useState([]); // up to 2 card ids
  const [matchedPairIds, setMatchedPairIds] = useState(new Set());
  const [flipCount, setFlipCount] = useState(0);
  const [startTime, setStartTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (done) return undefined;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startTime, done]);

  const score = useMemo(() => {
    const extraFlips = Math.max(0, flipCount - ROUND_SIZE * 2);
    return Math.max(0, 500 - extraFlips * 10 - elapsed * 3);
  }, [flipCount, elapsed]);

  function flip(card) {
    if (busy || flipped.includes(card.id) || matchedPairIds.has(card.pairId)) return;
    const next = [...flipped, card.id];
    setFlipped(next);

    if (next.length === 2) {
      setFlipCount((c) => c + 1);
      const [firstId, secondId] = next;
      const first = deck.find((c) => c.id === firstId);
      const second = deck.find((c) => c.id === secondId);
      setBusy(true);
      if (first.pairId === second.pairId) {
        setTimeout(() => {
          setMatchedPairIds((prev) => {
            const nextSet = new Set(prev);
            nextSet.add(first.pairId);
            if (nextSet.size === ROUND_SIZE) finish();
            return nextSet;
          });
          setFlipped([]);
          setBusy(false);
        }, 400);
      } else {
        setTimeout(() => {
          setFlipped([]);
          setBusy(false);
        }, 800);
      }
    }
  }

  function finish() {
    setDone(true);
  }

  // Runs once the final match completes and `done` flips true, so the score
  // captured for saving reflects the finishing flip/time, not a stale value.
  useEffect(() => {
    if (!done) return;
    if (!guest) {
      setSaving(true);
      submitGameResult('ticker-match', score, { flips: flipCount, seconds: elapsed })
        .then(() => onScoreSaved())
        .catch(() => {})
        .finally(() => setSaving(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function playAgain() {
    setDeck(buildDeck());
    setFlipped([]);
    setMatchedPairIds(new Set());
    setFlipCount(0);
    setStartTime(Date.now());
    setElapsed(0);
    setDone(false);
  }

  if (done) {
    return (
      <GameShell title="Ticker Match" onExit={onExit}>
        <div className="game-result">
          <div className="game-result-label">Score</div>
          <div className="game-result-score positive">{score}</div>
          <p className="game-result-detail">
            Matched all {ROUND_SIZE} pairs in {flipCount} flips, {elapsed}s.
          </p>
          <div className="game-actions">
            <button type="button" className="primary-button" onClick={playAgain}>
              Play again
            </button>
            <button type="button" className="secondary-button" onClick={onExit}>
              Back to Games
            </button>
          </div>
          {saving && <p className="empty-state">Saving score…</p>}
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell title="Ticker Match" onExit={onExit}>
      <div className="speed-round-header">
        <span className="speed-round-score">Flips: {flipCount}</span>
        <span className="speed-round-score">{elapsed}s</span>
      </div>
      <p className="learn-lesson-summary">Flip two cards at a time to match each company with its ticker symbol.</p>

      <div className="match-grid">
        {deck.map((card) => {
          const isFlipped = flipped.includes(card.id) || matchedPairIds.has(card.pairId);
          const isMatched = matchedPairIds.has(card.pairId);
          return (
            <button
              type="button"
              key={card.id}
              className={`match-card ${isFlipped ? 'flipped' : ''} ${isMatched ? 'matched' : ''}`}
              onClick={() => flip(card)}
              disabled={isFlipped}
            >
              {isFlipped ? card.label : <Icon name="grid" size={18} />}
            </button>
          );
        })}
      </div>
    </GameShell>
  );
}
