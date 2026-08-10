import { useEffect, useMemo, useState } from 'react';
import GameShell from './GameShell.jsx';
import { LEARN_TOPICS } from '../lib/lessons.js';
import { SPEED_ROUND_EXTRA_QUESTIONS } from '../lib/speedRoundQuestions.js';
import { submitGameResult } from '../lib/api.js';

const ROUND_SECONDS = 60;

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function SpeedRoundGame({ guest, onExit, onScoreSaved }) {
  const pool = useMemo(
    () => shuffle([...LEARN_TOPICS.flatMap((t) => t.lessons).flatMap((l) => l.quiz), ...SPEED_ROUND_EXTRA_QUESTIONS]),
    []
  );
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [pickedIndex, setPickedIndex] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!started || done) return undefined;
    if (secondsLeft <= 0) {
      finish();
      return undefined;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, done, secondsLeft]);

  function finish() {
    setDone(true);
    if (!guest) {
      setSaving(true);
      submitGameResult('speed-round', score)
        .then(() => onScoreSaved())
        .catch(() => {})
        .finally(() => setSaving(false));
    }
  }

  function choose(optIndex) {
    if (answered) return;
    setPickedIndex(optIndex);
    setAnswered(true);
    const question = pool[qIndex % pool.length];
    if (optIndex === question.correctIndex) setScore((s) => s + 1);
    setTimeout(() => {
      setAnswered(false);
      setPickedIndex(null);
      setQIndex((i) => i + 1);
    }, 400);
  }

  function playAgain() {
    setStarted(false);
    setDone(false);
    setSecondsLeft(ROUND_SECONDS);
    setQIndex(0);
    setScore(0);
    setAnswered(false);
    setPickedIndex(null);
  }

  if (!started) {
    return (
      <GameShell title="Speed Round Trivia" onExit={onExit}>
        <div className="game-result">
          <p className="game-result-detail">
            {ROUND_SECONDS} seconds, unlimited questions pulled from every Learn lesson. Answer as many
            correctly as you can — wrong answers just move you to the next one, no penalty.
          </p>
          <div className="game-actions">
            <button type="button" className="primary-button" onClick={() => setStarted(true)}>
              Start
            </button>
          </div>
        </div>
      </GameShell>
    );
  }

  if (done) {
    return (
      <GameShell title="Speed Round Trivia" onExit={onExit}>
        <div className="game-result">
          <div className="game-result-label">Correct answers</div>
          <div className="game-result-score positive">{score}</div>
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

  const question = pool[qIndex % pool.length];

  return (
    <GameShell title="Speed Round Trivia" onExit={onExit}>
      <div className="speed-round-header">
        <span className="speed-round-timer">{secondsLeft}s</span>
        <span className="speed-round-score">Score: {score}</span>
      </div>
      <div className="quiz-question">
        <p className="quiz-question-text">{question.question}</p>
        <div className="quiz-options">
          {question.options.map((option, optIndex) => {
            let stateClass = '';
            if (answered && optIndex === pickedIndex && optIndex === question.correctIndex) stateClass = 'correct';
            else if (answered && optIndex === pickedIndex) stateClass = 'incorrect';
            else if (answered && optIndex === question.correctIndex) stateClass = 'correct';
            return (
              <button
                key={optIndex}
                type="button"
                className={`quiz-option ${stateClass}`}
                onClick={() => choose(optIndex)}
                disabled={answered}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </GameShell>
  );
}
