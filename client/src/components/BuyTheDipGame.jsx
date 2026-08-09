import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Line, YAxis, ReferenceDot, ResponsiveContainer } from 'recharts';
import GameShell from './GameShell.jsx';
import { submitGameResult } from '../lib/api.js';

const STEPS = 60;
const TICK_MS = 110;

// A procedurally generated "trading day": drifts down, dips harder in the
// middle third, then drifts back up — a real-ish shape without ever being
// perfectly predictable, since the random walk means the exact bottom still
// has to be watched for, not calculated in advance.
function generatePath() {
  const path = [{ i: 0, price: 100 }];
  const dipStart = Math.floor(STEPS * 0.3);
  const dipEnd = Math.floor(STEPS * 0.65);
  for (let i = 1; i < STEPS; i += 1) {
    let bias;
    if (i < dipStart) bias = -0.15;
    else if (i < dipEnd) bias = -0.55;
    else bias = 0.35;
    const move = bias + (Math.random() - 0.5) * 1.6;
    const next = Math.max(40, path[i - 1].price + move);
    path.push({ i, price: Math.round(next * 100) / 100 });
  }
  return path;
}

export default function BuyTheDipGame({ guest, onExit, onScoreSaved }) {
  const [round, setRound] = useState(0); // bump to force a fresh path + effect run
  const [path, setPath] = useState(generatePath);
  const [visibleCount, setVisibleCount] = useState(1);
  const [bought, setBought] = useState(null); // { i, price } | null
  const [running, setRunning] = useState(true);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setVisibleCount((c) => {
        if (c >= path.length) {
          clearInterval(intervalRef.current);
          setRunning(false);
          return c;
        }
        return c + 1;
      });
    }, TICK_MS);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const trueMin = useMemo(() => path.reduce((min, p) => (p.price < min.price ? p : min), path[0]), [path]);

  function buy() {
    if (bought || !running) return;
    clearInterval(intervalRef.current);
    setRunning(false);
    const current = path[visibleCount - 1];
    setBought(current);
  }

  const ended = !running;
  const score = bought
    ? Math.max(0, Math.round(100 - ((bought.price - trueMin.price) / trueMin.price) * 100 * 8))
    : 0;

  useEffect(() => {
    if (!ended) return;
    if (!guest) {
      setSaving(true);
      submitGameResult('buy-the-dip', score, {
        boughtPrice: bought?.price ?? null,
        truePrice: trueMin.price,
      })
        .then(() => onScoreSaved())
        .catch(() => {})
        .finally(() => setSaving(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  function playAgain() {
    setPath(generatePath());
    setVisibleCount(1);
    setBought(null);
    setRunning(true);
    setRound((r) => r + 1);
  }

  const chartData = ended ? path : path.slice(0, visibleCount);

  return (
    <GameShell title="Buy the Dip" onExit={onExit}>
      {!ended && (
        <p className="learn-lesson-summary">
          The price is moving in real time. Click <strong>Buy</strong> as close to the bottom as you can, before
          it turns back up.
        </p>
      )}

      <div className="dip-chart">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <YAxis hide domain={[(dataMin) => dataMin - 3, (dataMax) => dataMax + 3]} />
            <Line type="monotone" dataKey="price" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
            {ended && bought && (
              <ReferenceDot x={bought.i} y={bought.price} r={6} fill="var(--amber)" stroke="none" />
            )}
            {ended && (
              <ReferenceDot x={trueMin.i} y={trueMin.price} r={6} fill="var(--green)" stroke="none" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {!ended ? (
        <div className="game-actions">
          <button type="button" className="primary-button dip-buy-button" onClick={buy}>
            Buy now — ${path[visibleCount - 1].price.toFixed(2)}
          </button>
        </div>
      ) : (
        <div className="game-result">
          <div className="game-result-label">Score</div>
          <div className={`game-result-score ${score >= 60 ? 'positive' : 'negative'}`}>{score}/100</div>
          <p className="game-result-detail">
            {bought ? (
              <>
                You bought at <strong>${bought.price.toFixed(2)}</strong> (
                <span className="amber-dot" />
                amber). The actual bottom was <strong>${trueMin.price.toFixed(2)}</strong> (
                <span className="green-dot" />
                green).
              </>
            ) : (
              <>You never clicked Buy — the actual bottom was ${trueMin.price.toFixed(2)}.</>
            )}
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
      )}
    </GameShell>
  );
}
