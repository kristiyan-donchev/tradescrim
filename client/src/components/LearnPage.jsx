import { useMemo, useState } from 'react';
import { LEARN_TOPICS } from '../lib/lessons.js';
import { GLOSSARY_TERMS } from '../lib/glossary.js';
import { useLessonProgress } from '../hooks/useLessonProgress.js';
import LessonQuiz from './LessonQuiz.jsx';
import { Icon } from './icons.jsx';

const GLOSSARY_LESSON_ID = 'glossary-reference';

// One fixed, vivid color per unit banner/path — a Duolingo-style skill tree
// keeps each unit visually distinct regardless of light/dark theme, so this
// intentionally doesn't use the theme's --primary/--green tokens.
const UNIT_COLORS = [
  '#58cc02', // green
  '#1cb0f6', // blue
  '#ce82ff', // purple
  '#ff9600', // orange
  '#ff4b4b', // red
  '#12b981', // teal
  '#7c5cff', // indigo
  '#ffc800', // gold
  '#ff86c8', // pink
];

// A gentle left-right sway per node down the path, echoing Duolingo's
// winding skill tree instead of a plain vertical list.
const PATH_OFFSETS = [0, 56, 84, 56, 0, -56, -84, -56];

export default function LearnPage() {
  const { isComplete, markComplete, currentStreak } = useLessonProgress();
  const [activeLessonId, setActiveLessonId] = useState(null);

  // A topic unlocks once every lesson in the topic before it is complete —
  // the first topic is always unlocked. Keeps the section feeling like a
  // course with a beginning and end instead of a flat pile of articles.
  const topicUnlocked = useMemo(() => {
    const unlocked = {};
    let previousTopicDone = true;
    for (const topic of LEARN_TOPICS) {
      unlocked[topic.id] = previousTopicDone;
      previousTopicDone = topic.lessons.every((l) => isComplete(l.id));
    }
    return unlocked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  const totalLessons = useMemo(
    () => LEARN_TOPICS.reduce((sum, topic) => sum + topic.lessons.length, 0) + 1, // +1 for glossary
    []
  );
  const completedCount = useMemo(() => {
    let count = isComplete(GLOSSARY_LESSON_ID) ? 1 : 0;
    for (const topic of LEARN_TOPICS) {
      for (const lesson of topic.lessons) {
        if (isComplete(lesson.id)) count += 1;
      }
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);
  const progressPercent = Math.round((completedCount / totalLessons) * 100);

  const allLessonsFlat = useMemo(() => LEARN_TOPICS.flatMap((t) => t.lessons), []);
  const activeLesson =
    activeLessonId && activeLessonId !== GLOSSARY_LESSON_ID
      ? allLessonsFlat.find((l) => l.id === activeLessonId)
      : null;

  // The next lesson a learner hasn't finished yet, in course order — this is
  // where the "START" flag on the path points, mirroring Duolingo always
  // nudging you toward the next node instead of the top of the list.
  const nextUpLessonId = useMemo(() => {
    for (const topic of LEARN_TOPICS) {
      if (!topicUnlocked[topic.id]) break;
      for (const lesson of topic.lessons) {
        if (!isComplete(lesson.id)) return lesson.id;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicUnlocked, isComplete]);

  // Completing a lesson is exactly what unlocks the rest of its own topic
  // and (if it was the topic's last lesson) the next topic too, so the
  // immediately-following lesson in reading order is always safe to jump to
  // the moment this one is done — no separate lock check needed here.
  const nextLesson = activeLesson
    ? allLessonsFlat[allLessonsFlat.findIndex((l) => l.id === activeLesson.id) + 1]
    : null;

  function closeLesson() {
    setActiveLessonId(null);
  }

  return (
    <>
      <section className="panel learn-progress-panel">
        <div className="learn-progress-header">
          <h2>Your progress</h2>
          <div className="learn-progress-stats">
            {currentStreak >= 2 && (
              <span className="learn-streak" title="Consecutive lessons passed on the first try">
                <Icon name="flame" size={14} /> {currentStreak} streak
              </span>
            )}
            <span className="learn-progress-count">
              {completedCount} / {totalLessons} lessons complete
            </span>
          </div>
        </div>
        <div className="learn-progress-bar">
          <div className="learn-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      <div className="learn-path">
        {LEARN_TOPICS.map((topic, topicIndex) => {
          const unlocked = topicUnlocked[topic.id];
          const color = UNIT_COLORS[topicIndex % UNIT_COLORS.length];
          return (
            <section className="learn-unit" key={topic.id}>
              <div
                className={unlocked ? 'learn-unit-banner' : 'learn-unit-banner locked'}
                style={unlocked ? { background: color } : undefined}
              >
                <div className="learn-unit-banner-icon">
                  <Icon name={unlocked ? topic.icon : 'lock'} size={22} />
                </div>
                <div>
                  <div className="learn-unit-banner-title">{topic.title}</div>
                  <div className="learn-unit-banner-desc">
                    {unlocked ? topic.description : 'Complete the previous unit to unlock'}
                  </div>
                </div>
              </div>

              <div className="learn-unit-nodes">
                {topic.lessons.map((lesson, lessonIndex) => {
                  const complete = isComplete(lesson.id);
                  const isNextUp = lesson.id === nextUpLessonId;
                  const offset = PATH_OFFSETS[lessonIndex % PATH_OFFSETS.length];
                  let nodeClass = 'learn-path-node';
                  if (!unlocked) nodeClass += ' locked';
                  else if (complete) nodeClass += ' complete';
                  else nodeClass += ' available';

                  return (
                    <div
                      className="learn-path-node-wrap"
                      style={{ '--node-offset': `${offset}px`, transform: 'translateX(var(--node-offset))' }}
                      key={lesson.id}
                    >
                      {isNextUp && <div className="learn-path-start-flag">START</div>}
                      <button
                        type="button"
                        className={nodeClass}
                        style={unlocked ? { '--node-color': color } : undefined}
                        disabled={!unlocked}
                        onClick={() => setActiveLessonId(lesson.id)}
                        title={unlocked ? lesson.title : 'Complete the previous unit to unlock this one'}
                      >
                        <Icon name={complete ? 'check' : !unlocked ? 'lock' : 'star'} size={22} filled={complete} />
                      </button>
                      <div className="learn-path-node-label">{lesson.title}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="learn-unit">
          <div className="learn-unit-banner learn-unit-banner-reference">
            <div className="learn-unit-banner-icon">
              <Icon name="book-open" size={22} />
            </div>
            <div>
              <div className="learn-unit-banner-title">Reference</div>
              <div className="learn-unit-banner-desc">Quick definitions for common investing vocabulary</div>
            </div>
          </div>
          <div className="learn-unit-nodes">
            <div className="learn-path-node-wrap">
              <button
                type="button"
                className={isComplete(GLOSSARY_LESSON_ID) ? 'learn-path-node complete' : 'learn-path-node available'}
                style={{ '--node-color': 'var(--muted)' }}
                onClick={() => setActiveLessonId(GLOSSARY_LESSON_ID)}
                title="Glossary"
              >
                <Icon name={isComplete(GLOSSARY_LESSON_ID) ? 'check' : 'book-open'} size={22} filled={isComplete(GLOSSARY_LESSON_ID)} />
              </button>
              <div className="learn-path-node-label">Glossary</div>
            </div>
          </div>
        </section>
      </div>

      {activeLessonId && (
        <div className="modal-overlay" onClick={closeLesson}>
          <div className="modal learn-lesson-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{activeLessonId === GLOSSARY_LESSON_ID ? 'Glossary' : activeLesson?.title}</h2>
              <button type="button" className="icon-button" onClick={closeLesson} aria-label="Close">
                <Icon name="x" size={16} />
              </button>
            </div>

            {activeLessonId === GLOSSARY_LESSON_ID && (
              <>
                <p className="learn-lesson-summary">Quick definitions for common investing vocabulary used throughout the app.</p>
                <dl className="glossary">
                  {GLOSSARY_TERMS.map((t) => (
                    <div key={t.term} className="glossary-item">
                      <dt>{t.term}</dt>
                      <dd>{t.text}</dd>
                    </div>
                  ))}
                </dl>
                {isComplete(GLOSSARY_LESSON_ID) ? (
                  <p className="quiz-complete">
                    <Icon name="check" size={14} /> Reviewed
                  </p>
                ) : (
                  <button type="button" className="secondary-button" onClick={() => markComplete(GLOSSARY_LESSON_ID)}>
                    Mark as reviewed
                  </button>
                )}
              </>
            )}

            {activeLesson && (
              <>
                <p className="learn-lesson-summary">{activeLesson.summary}</p>

                {activeLesson.sections.map((section) => (
                  <div className="learn-section" key={section.heading}>
                    <h3>{section.heading}</h3>
                    {section.body && <p>{section.body}</p>}
                    {section.list && (
                      <ul>
                        {section.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

                <LessonQuiz
                  key={activeLesson.id}
                  questions={activeLesson.quiz}
                  onAllCorrect={(firstTryPerfect) => markComplete(activeLesson.id, firstTryPerfect)}
                  nextLessonTitle={nextLesson?.title}
                  onNextLesson={nextLesson ? () => setActiveLessonId(nextLesson.id) : undefined}
                  alreadyComplete={isComplete(activeLesson.id)}
                />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
