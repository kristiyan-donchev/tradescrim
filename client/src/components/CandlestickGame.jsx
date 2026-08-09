import { useEffect, useState } from 'react';
import GameShell from './GameShell.jsx';
import { Icon } from './icons.jsx';
import { fetchCandlestickRound, submitGameResult } from '../lib/api.js';

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 220;

// recharts has no built-in candlestick type, so this is a small hand-rolled
// SVG renderer: a wick (thin line, low-to-high) plus a body (rect,
// open-to-close), colored by whether the candle closed up or down — the
// exact visual vocabulary the "Chart types" Learn lesson introduces.
function CandlestickChart({ candles }) {
  const priceMin = Math.min(...candles.map((c) => c.low));
  const priceMax = Math.max(...candles.map((c) => c.high));
  const pad = (priceMax - priceMin) * 0.08 || 1;
  const lo = priceMin - pad;
  const hi = priceMax + pad;
  const y = (price) => VIEW_HEIGHT - ((price - lo) / (hi - lo)) * VIEW_HEIGHT;

  const slotWidth = VIEW_WIDTH / candles.length;
  const bodyWidth = Math.max(2, slotWidth * 0.6);

  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="candlestick-chart" preserveAspectRatio="none">
      {candles.map((c, i) => {
        const x = i * slotWidth + slotWidth / 2;
        const up = c.close >= c.open;
        const color = up ? 'var(--green)' : 'var(--red)';
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBottom = y(Math.min(c.open, c.close));
        return (
          <g key={c.date}>
            <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1} />
            <rect
              x={x - bodyWidth / 2}
              y={bodyTop}
              width={bodyWidth}
              height={Math.max(1, bodyBottom - bodyTop)}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}

export default function CandlestickGame({ guest, onExit, onScoreSaved }) {
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bestThisSession, setBestThisSession] = useState(0);
  const [ended, setEnded] = useState(false);
  const [saving, setSaving] = useState(false);

  function loadRound() {
    setLoading(true);
    setError(null);
    setPicked(null);
    fetchCandlestickRound()
      .then(setRound)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadRound, []);

  function guess(direction) {
    if (picked) return;
    setPicked(direction);
    if (direction === round.direction) {
      const next = streak + 1;
      setStreak(next);
      setBestThisSession((b) => Math.max(b, next));
    }
  }

  function finish() {
    setEnded(true);
    if (!guest && bestThisSession > 0) {
      setSaving(true);
      submitGameResult('candlestick-pattern', bestThisSession)
        .then(() => onScoreSaved())
        .catch(() => {})
        .finally(() => setSaving(false));
    }
  }

  function playAgain() {
    setStreak(0);
    setBestThisSession(0);
    setEnded(false);
    loadRound();
  }

  if (ended) {
    return (
      <GameShell title="Candlestick Pattern Trainer" onExit={onExit}>
        <div className="game-result">
          <div className="game-result-label">Streak ended</div>
          <div className="game-result-score positive">{bestThisSession}</div>
          <p className="game-result-detail">correct guesses in a row</p>
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
    <GameShell title="Candlestick Pattern Trainer" onExit={onExit}>
      <div className="speed-round-header">
        <span className="speed-round-score">
          <Icon name="flame" size={14} /> Streak: {streak}
        </span>
      </div>
      <p className="learn-lesson-summary">
        A real candlestick chart, most recent days hidden. Did the price go up or down over the days that
        follow?
      </p>

      {loading && <p className="empty-state">Loading a chart…</p>}
      {error && <div className="form-error">{error}</div>}

      {round && (
        <>
          <CandlestickChart candles={round.candles} />

          {!picked ? (
            <div className="crash-actions">
              <button type="button" className="secondary-button bull-option" onClick={() => guess('up')}>
                <Icon name="trending-up" size={16} /> It went up
              </button>
              <button type="button" className="secondary-button bear-option" onClick={() => guess('down')}>
                <Icon name="trending-down" size={16} /> It went down
              </button>
            </div>
          ) : (
            <div className="game-result">
              <p className={picked === round.direction ? 'positive' : 'negative'}>
                {round.symbol} actually went {round.direction} {round.changePercent >= 0 ? '+' : ''}
                {round.changePercent.toFixed(1)}% — you guessed {picked}.
              </p>
              <div className="game-actions">
                {picked === round.direction ? (
                  <button type="button" className="primary-button" onClick={loadRound}>
                    Next round
                  </button>
                ) : (
                  <button type="button" className="primary-button" onClick={finish}>
                    See results
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </GameShell>
  );
}
