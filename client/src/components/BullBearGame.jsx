import { useEffect, useState } from 'react';
import GameShell from './GameShell.jsx';
import { Icon } from './icons.jsx';
import { fetchBullBearRound, submitGameResult } from '../lib/api.js';

export default function BullBearGame({ guest, onExit, onScoreSaved }) {
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
    fetchBullBearRound()
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
      submitGameResult('bull-or-bear', bestThisSession)
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
      <GameShell title="Bull or Bear" onExit={onExit}>
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
    <GameShell title="Bull or Bear" onExit={onExit}>
      <div className="speed-round-header">
        <span className="speed-round-score">
          <Icon name="flame" size={14} /> Streak: {streak}
        </span>
      </div>
      <p className="learn-lesson-summary">
        A real headline from today's market news. Did the stock it's about go up or down that day?
      </p>

      {loading && <p className="empty-state">Loading a headline…</p>}
      {error && <div className="form-error">{error}</div>}

      {round && (
        <>
          <div className="bull-bear-headline">
            <Icon name="newspaper" size={18} />
            <div>
              <p>{round.headline}</p>
              <span className="muted">{round.publisher}</span>
            </div>
          </div>

          {!picked ? (
            <div className="crash-actions">
              <button type="button" className="secondary-button bull-option" onClick={() => guess('up')}>
                <Icon name="trending-up" size={16} /> Bull — it went up
              </button>
              <button type="button" className="secondary-button bear-option" onClick={() => guess('down')}>
                <Icon name="trending-down" size={16} /> Bear — it went down
              </button>
            </div>
          ) : (
            <div className="game-result">
              <p className={picked === round.direction ? 'positive' : 'negative'}>
                {round.symbol} actually went {round.direction} {round.changePercent >= 0 ? '+' : ''}
                {round.changePercent.toFixed(1)}% that day — you guessed {picked}.
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
