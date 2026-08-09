import { useState } from 'react';
import GameShell from './GameShell.jsx';
import { Icon } from './icons.jsx';
import { submitGameResult } from '../lib/api.js';

const STARTING_VALUE = 10000;

// A scripted crash-then-recovery arc — holding the whole way through nets
// roughly +2% (classic "time in the market beats timing the market"), but
// panic-selling near the bottom locks in the worst of the losses and misses
// the recovery entirely. Percentages apply before the round's action is
// known to the player, same as real markets.
const ROUNDS = [
  { narrative: 'Rumors of trouble spread through the market overnight.', change: -0.06 },
  { narrative: 'A major company misses earnings badly. Selling accelerates across the board.', change: -0.14 },
  { narrative: "News outlets are calling it a full-blown crash. It feels like everyone is panicking.", change: -0.18 },
  { narrative: 'The Fed hints at emergency support. Markets are choppy but stop falling.', change: 0.09 },
  { narrative: 'Confidence slowly returns as bargain hunters step back in.', change: 0.16 },
  { narrative: 'The dust settles. Markets stabilize back near pre-crash levels.', change: 0.22 },
];

function resultLabel(returnPercent) {
  if (returnPercent >= 15) return "Diamond hands — that paid off.";
  if (returnPercent >= 0) return 'You rode it out and came out ahead.';
  if (returnPercent >= -15) return 'Rough ride, but you kept some of your losses in check.';
  return 'That one hurt — selling near the bottom is the classic crash mistake.';
}

export default function MarketCrashGame({ guest, onExit, onScoreSaved }) {
  const [round, setRound] = useState(0);
  const [value, setValue] = useState(STARTING_VALUE);
  const [inMarket, setInMarket] = useState(true);
  const [multiplier, setMultiplier] = useState(1);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  function act(action) {
    const { narrative, change } = ROUNDS[round];
    let nextValue = value;
    let nextMultiplier = multiplier;
    let nextInMarket = inMarket;
    let appliedChange = 0;

    if (!inMarket) {
      // Already sold out — sit out the rest of the game untouched.
    } else if (action === 'sell') {
      nextInMarket = false;
    } else if (action === 'hold') {
      appliedChange = change * multiplier;
      nextValue = value * (1 + appliedChange);
    } else if (action === 'buy-dip') {
      appliedChange = change * multiplier;
      nextValue = value * (1 + appliedChange);
      nextMultiplier = Math.min(multiplier + 0.15, 1.6);
    } else if (action === 'hedge') {
      appliedChange = change * multiplier * 0.5;
      nextValue = value * (1 + appliedChange);
    }

    setLog((prev) => [...prev, { narrative, action, appliedChange, inMarket }]);
    setValue(nextValue);
    setMultiplier(nextMultiplier);
    setInMarket(nextInMarket);

    if (round + 1 >= ROUNDS.length) {
      finish(nextValue);
    } else {
      setRound(round + 1);
    }
  }

  function finish(finalValue) {
    setDone(true);
    const returnPercent = Math.round(((finalValue - STARTING_VALUE) / STARTING_VALUE) * 100);
    if (!guest) {
      setSaving(true);
      submitGameResult('market-crash', returnPercent, { finalValue: Math.round(finalValue) })
        .then(() => onScoreSaved())
        .catch(() => {})
        .finally(() => setSaving(false));
    }
  }

  function playAgain() {
    setRound(0);
    setValue(STARTING_VALUE);
    setInMarket(true);
    setMultiplier(1);
    setLog([]);
    setDone(false);
  }

  if (done) {
    const returnPercent = Math.round(((value - STARTING_VALUE) / STARTING_VALUE) * 100);
    return (
      <GameShell title="Market Crash Simulator" onExit={onExit}>
        <div className="game-result">
          <div className="game-result-label">Final portfolio</div>
          <div className={`game-result-score ${returnPercent >= 0 ? 'positive' : 'negative'}`}>
            {returnPercent > 0 ? '+' : ''}
            {returnPercent}%
          </div>
          <p className="game-result-detail">
            ${value.toFixed(0)} from a ${STARTING_VALUE.toLocaleString()} start. {resultLabel(returnPercent)}
            {!inMarket && ' You sold out before the end and sat in cash the rest of the way.'}
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
    <GameShell title="Market Crash Simulator" onExit={onExit}>
      <p className="learn-lesson-summary">
        You're fully invested. Each round, decide what to do before you see how the market actually moves.
      </p>

      <div className="crash-status">
        <div>
          <span className="crash-status-label">Portfolio value</span>
          <span className="crash-status-value">${value.toFixed(0)}</span>
        </div>
        <div>
          <span className="crash-status-label">Round</span>
          <span className="crash-status-value">
            {round + 1} / {ROUNDS.length}
          </span>
        </div>
      </div>

      <div className="crash-narrative">
        <Icon name="newspaper" size={18} />
        <p>{ROUNDS[round].narrative}</p>
      </div>

      {inMarket ? (
        <div className="crash-actions">
          <button type="button" className="secondary-button" onClick={() => act('hold')}>
            Hold
          </button>
          <button type="button" className="secondary-button" onClick={() => act('buy-dip')}>
            Buy the dip
          </button>
          <button type="button" className="secondary-button" onClick={() => act('hedge')}>
            Hedge (halve this round's move)
          </button>
          <button type="button" className="danger-button" onClick={() => act('sell')}>
            Sell everything
          </button>
        </div>
      ) : (
        <div className="crash-actions">
          <button type="button" className="secondary-button" onClick={() => act('sold')}>
            You're in cash — continue
          </button>
        </div>
      )}

      {log.length > 0 && (
        <div className="crash-log">
          {log.map((entry, i) => (
            <div key={i} className="crash-log-item">
              {entry.inMarket ? (
                <span className={entry.appliedChange >= 0 ? 'positive' : 'negative'}>
                  {entry.appliedChange >= 0 ? '+' : ''}
                  {(entry.appliedChange * 100).toFixed(1)}%
                </span>
              ) : (
                <span className="muted">in cash</span>
              )}{' '}
              — {entry.narrative}
            </div>
          ))}
        </div>
      )}
    </GameShell>
  );
}
