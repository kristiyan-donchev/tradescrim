import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchCompletedLessons, completeLesson } from '../lib/api.js';

const STORAGE_KEY = 'tradescrim-lesson-progress';

// Guests (no account) keep the original localStorage-only behavior — no
// server persistence, no badges, but Learn still fully works and still
// shows a live streak/lock UI from whatever's in this browser.
function loadLocalCompletions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // Migrate the old format (a bare array of lesson id strings) transparently.
    return parsed.map((entry, i) =>
      typeof entry === 'string'
        ? { lessonId: entry, completedAt: i, firstTryPerfect: true }
        : entry
    );
  } catch {
    return [];
  }
}

function saveLocalCompletions(completions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
}

export function useLessonProgress() {
  const { user } = useAuth();
  const [completions, setCompletions] = useState(() => (user ? [] : loadLocalCompletions()));
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    if (!user) {
      setCompletions(loadLocalCompletions());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCompletedLessons()
      .then((rows) => {
        if (!cancelled) setCompletions(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const markComplete = useCallback(
    (lessonId, firstTryPerfect = true) => {
      if (user) {
        completeLesson(lessonId, firstTryPerfect)
          .then(setCompletions)
          .catch(() => {});
        return;
      }
      setCompletions((prev) => {
        if (prev.some((c) => c.lessonId === lessonId)) return prev;
        const next = [...prev, { lessonId, completedAt: Date.now(), firstTryPerfect }];
        saveLocalCompletions(next);
        return next;
      });
    },
    [user]
  );

  const isComplete = useCallback((lessonId) => completions.some((c) => c.lessonId === lessonId), [completions]);

  // Longest run of first-try-perfect completions ending at the most recent
  // completion — resets to 0 the moment a lesson needed a retry, same rule
  // the server-side "On a Roll" badge uses.
  const currentStreak = (() => {
    let streak = 0;
    for (let i = completions.length - 1; i >= 0; i -= 1) {
      if (!completions[i].firstTryPerfect) break;
      streak += 1;
    }
    return streak;
  })();

  return { completions, isComplete, markComplete, loading, currentStreak };
}
