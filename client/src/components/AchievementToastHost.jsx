import { useEffect, useRef, useState } from 'react';
import { fetchAchievements } from '../lib/api.js';
import { Icon } from './icons.jsx';

const POLL_MS = 20000;
const VISIBLE_MS = 6000;

// Achievements have no push mechanism (no websockets in this app), so this
// polls the same endpoint the profile's badge grid uses and diffs the
// unlocked-id set against what it last saw. The first fetch after mount
// only seeds that set — it doesn't toast for everything already earned
// before this component existed.
export default function AchievementToastHost({ guest = false }) {
  const [toasts, setToasts] = useState([]);
  const seenIds = useRef(null);

  function dismiss(toastId) {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }

  useEffect(() => {
    if (guest) return undefined;
    let cancelled = false;

    function poll() {
      fetchAchievements()
        .then((achievements) => {
          if (cancelled) return;
          const unlocked = achievements.filter((a) => a.unlocked);

          if (seenIds.current === null) {
            seenIds.current = new Set(unlocked.map((a) => a.id));
            return;
          }

          const newlyUnlocked = unlocked.filter((a) => !seenIds.current.has(a.id));
          if (newlyUnlocked.length === 0) return;

          newlyUnlocked.forEach((achievement) => {
            seenIds.current.add(achievement.id);
            const toastId = `${achievement.id}-${Date.now()}`;
            setToasts((prev) => [...prev, { ...achievement, toastId }]);
            setTimeout(() => dismiss(toastId), VISIBLE_MS);
          });
        })
        .catch(() => {});
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [guest]);

  if (guest || toasts.length === 0) return null;

  return (
    <div className="achievement-toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          type="button"
          key={t.toastId}
          className="achievement-toast"
          onClick={() => dismiss(t.toastId)}
          title="Dismiss"
        >
          <span className="achievement-toast-icon">
            <Icon name={t.icon} size={20} />
          </span>
          <span className="achievement-toast-body">
            <span className="achievement-toast-label">Achievement unlocked</span>
            <span className="achievement-toast-title">{t.title}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
