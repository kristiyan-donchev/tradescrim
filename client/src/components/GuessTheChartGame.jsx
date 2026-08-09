import { useEffect, useState } from 'react';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';
import GameShell from './GameShell.jsx';
import { Icon } from './icons.jsx';
import { fetchChartPair, submitGameResult } from '../lib/api.js';

function BlindChart({ points, positive }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={points}>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Line
          type="monotone"
          dataKey="close"
          stroke={positive == null ? 'var(--primary)' : positive ? 'var(--green)' : 'var(--red)'}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function GuessTheChartGame({ guest, onExit, onScoreSaved }) {
  const [pair, setPair] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState(null);
  const [roundWasCorrect, setRoundWasCorrect] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bestThisSession, setBestThisSession] = useState(0);
  const [ended, setEnded] = useState(false);
  const [saving, setSaving] = useState(false);

  function loadRound() {
    setLoading(true);
    setError(null);
    setPicked(null);
    setRoundWasCorrect(null);
    fetchChartPair()
      .then(setPair)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadRound, []);

  function pick(side) {
    if (picked) return;
    setPicked(side);
    const correct =
      (side === 'a' && pair.a.changePercent >= pair.b.changePercent) ||
      (side === 'b' && pair.b.changePercent >= pair.a.changePercent);
    setRoundWasCorrect(correct);
    if (correct) {
      const next = streak + 1;
      setStreak(next);
      setBestThisSession((b) => Math.max(b, next));
    }
  }

  function finish(finalStreak) {
    setEnded(true);
    if (!guest && finalStreak > 0) {
      setSaving(true);
      submitGameResult('guess-the-chart', finalStreak)
        .then(() => onScoreSaved())
        .catch(() => {})
        .finally(() => setSaving(false));
    }
  }

  function next() {
    loadRound();
  }

  function playAgain() {
    setStreak(0);
    setBestThisSession(0);
    setEnded(false);
    loadRound();
  }

  if (ended) {
    return (
      <GameShell title="Guess the Chart" onExit={onExit}>
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
    <GameShell title="Guess the Chart" onExit={onExit}>
      <div className="speed-round-header">
        <span className="speed-round-score">
          <Icon name="flame" size={14} /> Streak: {streak}
        </span>
      </div>
      <p className="learn-lesson-summary">
        Two real 3-month price charts. Which one had the better return? Symbols are hidden until you pick.
      </p>

      {loading && <p className="empty-state">Loading charts…</p>}
      {error && <div className="form-error">{error}</div>}

      {pair && (
        <div className="chart-pair">
          {['a', 'b'].map((side) => {
            const data = pair[side];
            const revealed = picked != null;
            const isWinner = revealed && data.changePercent >= pair[side === 'a' ? 'b' : 'a'].changePercent;
            return (
              <button
                type="button"
                key={side}
                className={`chart-pair-option ${revealed ? (isWinner ? 'correct' : 'incorrect') : ''}`}
                onClick={() => pick(side)}
                disabled={revealed}
              >
                <BlindChart points={data.points} positive={revealed ? data.changePercent >= 0 : null} />
                <div className="chart-pair-label">
                  {revealed ? (
                    <>
                      <strong>{data.symbol}</strong>{' '}
                      <span className={data.changePercent >= 0 ? 'positive' : 'negative'}>
                        {data.changePercent >= 0 ? '+' : ''}
                        {data.changePercent.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    side.toUpperCase()
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {picked && (
        <div className="game-actions" style={{ marginTop: 16 }}>
          {roundWasCorrect ? (
            <button type="button" className="primary-button" onClick={next}>
              Next round
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={() => finish(bestThisSession)}>
              See results
            </button>
          )}
        </div>
      )}
    </GameShell>
  );
}
