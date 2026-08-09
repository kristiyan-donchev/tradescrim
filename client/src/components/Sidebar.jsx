import { useEffect, useState } from 'react';
import ProfileMenu from './ProfileMenu.jsx';
import ReportBugButton from './ReportBugButton.jsx';
import { Icon } from './icons.jsx';
import { fetchUnseenAlertCount, fetchUnseenFriendRequestCount } from '../lib/api.js';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'bar-chart' },
  { key: 'news', label: 'News', icon: 'newspaper' },
  { key: 'learn', label: 'Learn', icon: 'graduation-cap' },
  { key: 'games', label: 'Games', icon: 'joystick' },
  { key: 'watchlist', label: 'Watchlist', icon: 'eye' },
  { key: 'challenges', label: 'Challenges', icon: 'target' },
  { key: 'friends', label: 'Friends', icon: 'users' },
  { key: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
];

const UNSEEN_POLL_MS = 30000;

export default function Sidebar({ page, onNavigate, onShowHelp, onReset, guest = false, onRequestLogin }) {
  const [unseenAlerts, setUnseenAlerts] = useState(0);
  const [unseenRequests, setUnseenRequests] = useState(0);

  useEffect(() => {
    if (guest) return undefined;
    let cancelled = false;
    function poll() {
      fetchUnseenAlertCount()
        .then((count) => {
          if (!cancelled) setUnseenAlerts(count);
        })
        .catch(() => {});
      fetchUnseenFriendRequestCount()
        .then((count) => {
          if (!cancelled) setUnseenRequests(count);
        })
        .catch(() => {});
    }
    poll();
    const interval = setInterval(poll, UNSEEN_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [page, guest]);

  return (
    <nav className="sidebar">
      <button type="button" className="sidebar-logo" onClick={() => onNavigate('dashboard')}>
        <span className="sidebar-logo-mark">
          <Icon name="trending-up" size={22} />
        </span>
        <span className="sidebar-logo-text">TradeScrim</span>
      </button>

      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={page === item.key ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
            onClick={() => onNavigate(item.key)}
          >
            <span className="sidebar-nav-icon">
              <Icon name={item.icon} size={18} />
            </span>
            <span className="sidebar-nav-label">{item.label}</span>
            {item.key === 'watchlist' && unseenAlerts > 0 && (
              <span className="sidebar-nav-badge">{unseenAlerts}</span>
            )}
            {item.key === 'friends' && unseenRequests > 0 && (
              <span className="sidebar-nav-badge">{unseenRequests}</span>
            )}
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-nav-item" onClick={onShowHelp}>
          <span className="sidebar-nav-icon">
            <Icon name="help-circle" size={18} />
          </span>
          <span className="sidebar-nav-label">Help &amp; terms</span>
        </button>

        <ReportBugButton page={page} guest={guest} onRequestLogin={onRequestLogin} />

        {guest ? (
          <button type="button" className="sidebar-nav-item" onClick={onRequestLogin}>
            <span className="sidebar-nav-icon">
              <Icon name="lock" size={18} />
            </span>
            <span className="sidebar-nav-label">Log in</span>
          </button>
        ) : (
          <ProfileMenu onReset={onReset} />
        )}
      </div>
    </nav>
  );
}
