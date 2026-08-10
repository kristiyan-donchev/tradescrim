import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';

export default function LessonQuiz({ questions, onAllCorrect, nextLessonTitle, onNextLesson, alreadyComplete }) {
  const [selected, setSelected] = useState({});
  const [solved, setSolved] = useState({});
  const [missedAny, setMissedAny] = useState(false);

  useEffect(() => {
    setSelected({});
    setSolved({});
    setMissedAny(false);
  }, [questions]);

  function choose(qIndex, optIndex) {
    if (solved[qIndex]) return;
    setSelected((prev) => ({ ...prev, [qIndex]: optIndex }));
    if (optIndex === questions[qIndex].correctIndex) {
      setSolved((prev) => ({ ...prev, [qIndex]: true }));
    } else {
      setMissedAny(true);
    }
  }

  const allCorrect = questions.length > 0 && questions.every((_, i) => solved[i]);
  const showComplete = allCorrect || alreadyComplete;

  useEffect(() => {
    if (allCorrect) onAllCorrect(!missedAny);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCorrect]);

  if (questions.length === 0) return null;

  return (
    <div className="lesson-quiz">
      <h3>Check your understanding</h3>
      {questions.map((q, qIndex) => {
        const pickedIndex = selected[qIndex];
        const isSolved = solved[qIndex];
        return (
          <div className="quiz-question" key={qIndex}>
            <p className="quiz-question-text">{q.question}</p>
            <div className="quiz-options">
              {q.options.map((option, optIndex) => {
                const isPicked = pickedIndex === optIndex;
                let stateClass = '';
                if (isPicked && optIndex === q.correctIndex) stateClass = 'correct';
                else if (isPicked) stateClass = 'incorrect';
                return (
                  <button
                    key={optIndex}
                    type="button"
                    className={`quiz-option ${stateClass}`}
                    onClick={() => choose(qIndex, optIndex)}
                    disabled={isSolved}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {pickedIndex != null && (
              <p className={isSolved ? 'quiz-feedback correct' : 'quiz-feedback incorrect'}>
                {isSolved ? (
                  <>
                    <Icon name="check" size={14} /> Correct —{' '}
                  </>
                ) : (
                  <>
                    <Icon name="x-circle" size={14} /> Not quite —{' '}
                  </>
                )}
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}
      {showComplete && (
        <div className="quiz-complete-block">
          <p className="quiz-complete">
            <Icon name="sparkles" size={14} /> Lesson complete — nice work!
          </p>
          {onNextLesson && (
            <button type="button" className="primary-button" onClick={onNextLesson}>
              Next lesson: {nextLessonTitle} <Icon name="arrow-right" size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
