import { useState } from 'react';
import GameShell from './GameShell.jsx';
import { Icon } from './icons.jsx';
import { INVESTOR_QUIZ_QUESTIONS, INVESTOR_TYPES } from '../lib/investorQuiz.js';

// No score/leaderboard for this one on purpose — it produces a shareable
// "type" rather than a ranked number, so it's excluded from GAMES_META's
// leaderboard-eligible list (see hasLeaderboard: false there).
export default function InvestorQuizGame({ onExit }) {
  const [qIndex, setQIndex] = useState(0);
  const [tally, setTally] = useState({});
  const [resultType, setResultType] = useState(null);

  function choose(type) {
    const nextTally = { ...tally, [type]: (tally[type] || 0) + 1 };
    setTally(nextTally);
    if (qIndex + 1 >= INVESTOR_QUIZ_QUESTIONS.length) {
      const winner = Object.entries(nextTally).sort((a, b) => b[1] - a[1])[0][0];
      setResultType(winner);
    } else {
      setQIndex(qIndex + 1);
    }
  }

  function retake() {
    setQIndex(0);
    setTally({});
    setResultType(null);
  }

  if (resultType) {
    const type = INVESTOR_TYPES[resultType];
    return (
      <GameShell title="Investor Personality Quiz" onExit={onExit}>
        <div className="game-result">
          <div className="investor-result-icon">
            <Icon name={type.icon} size={40} />
          </div>
          <div className="game-result-label">You are...</div>
          <div className="game-result-score positive investor-result-title">{type.title}</div>
          <p className="game-result-detail">{type.description}</p>
          <div className="game-actions">
            <button type="button" className="primary-button" onClick={retake}>
              Retake quiz
            </button>
            <button type="button" className="secondary-button" onClick={onExit}>
              Back to Games
            </button>
          </div>
        </div>
      </GameShell>
    );
  }

  const question = INVESTOR_QUIZ_QUESTIONS[qIndex];

  return (
    <GameShell title="Investor Personality Quiz" onExit={onExit}>
      <div className="speed-round-header">
        <span className="speed-round-score">
          Question {qIndex + 1} / {INVESTOR_QUIZ_QUESTIONS.length}
        </span>
      </div>
      <div className="quiz-question">
        <p className="quiz-question-text">{question.question}</p>
        <div className="quiz-options">
          {question.options.map((option) => (
            <button
              key={option.label}
              type="button"
              className="quiz-option"
              onClick={() => choose(option.type)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </GameShell>
  );
}
