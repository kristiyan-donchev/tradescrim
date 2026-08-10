import { useMemo, useState } from 'react';
import { LEARN_TOPICS } from '../lib/lessons.js';
import { GLOSSARY_TERMS } from '../lib/glossary.js';
import { useLessonProgress } from '../hooks/useLessonProgress.js';
import LessonQuiz from './LessonQuiz.jsx';
import { Icon } from './icons.jsx';

const GLOSSARY_LESSON_ID = 'glossary-reference';

export default function LearnPage() {
  const { isComplete, markComplete, currentStreak } = useLessonProgress();
  const [activeLessonId, setActiveLessonId] = useState(LEARN_TOPICS[0].lessons[0].id);

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
    activeLessonId === GLOSSARY_LESSON_ID ? null : allLessonsFlat.find((l) => l.id === activeLessonId);

  // Completing a lesson is exactly what unlocks the rest of its own topic
  // and (if it was the topic's last lesson) the next topic too, so the
  // immediately-following lesson in reading order is always safe to jump to
  // the moment this one is done — no separate lock check needed here.
  const nextLesson = activeLesson
    ? allLessonsFlat[allLessonsFlat.findIndex((l) => l.id === activeLesson.id) + 1]
    : null;

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

      <div className="learn-layout">
        <nav className="learn-nav">
          {LEARN_TOPICS.map((topic) => {
            const unlocked = topicUnlocked[topic.id];
            return (
              <div className={unlocked ? 'learn-topic-group' : 'learn-topic-group locked'} key={topic.id}>
                <div className="learn-topic-title">
                  <Icon name={unlocked ? topic.icon : 'lock'} size={16} /> {topic.title}
                </div>
                <div className="learn-lesson-list">
                  {topic.lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      disabled={!unlocked}
                      className={lesson.id === activeLessonId ? 'learn-lesson-item active' : 'learn-lesson-item'}
                      onClick={() => setActiveLessonId(lesson.id)}
                      title={unlocked ? undefined : 'Complete the previous topic to unlock this one'}
                    >
                      <span className="learn-lesson-check">
                        {isComplete(lesson.id) ? <Icon name="check" size={14} /> : ''}
                      </span>
                      {lesson.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="learn-topic-group">
            <div className="learn-topic-title">
              <Icon name="book-open" size={16} /> Reference
            </div>
            <div className="learn-lesson-list">
              <button
                type="button"
                className={activeLessonId === GLOSSARY_LESSON_ID ? 'learn-lesson-item active' : 'learn-lesson-item'}
                onClick={() => setActiveLessonId(GLOSSARY_LESSON_ID)}
              >
                <span className="learn-lesson-check">
                  {isComplete(GLOSSARY_LESSON_ID) ? <Icon name="check" size={14} /> : ''}
                </span>
                Glossary
              </button>
            </div>
          </div>
        </nav>

        <section className="panel learn-content">
          {activeLessonId === GLOSSARY_LESSON_ID && (
            <>
              <h2>Glossary</h2>
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
              <h2>{activeLesson.title}</h2>
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
        </section>
      </div>
    </>
  );
}
