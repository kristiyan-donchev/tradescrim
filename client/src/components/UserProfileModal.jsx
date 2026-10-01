import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';
import TransactionHistory from './TransactionHistory.jsx';
import { fetchUserProfile } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

function formatMemberSince(createdAt) {
  return new Date(createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Read-only view of another trader's profile, opened from the leaderboard or
// friends list. The server omits holdings/transactions for private profiles,
// so this only has to render whatever comes back.
export default function UserProfileModal({ userId, onClose }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    fetchUserProfile(userId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => {
        if (!cancelled) setErrorMsg(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const isMe = user && profile && user.id === profile.id;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal user-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isMe ? 'Your profile' : 'Trader profile'}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        {loading && <p className="empty-state">Loading profile…</p>}
        {errorMsg && <div className="form-error">{errorMsg}</div>}

        {!loading && !errorMsg && profile && (
          <>
            <div className="profile-info">
              <div className="profile-avatar-large">{profile.username[0]?.toUpperCase() || '?'}</div>
              <div>
                <div className="profile-info-username">
                  {profile.username}
                  {profile.isPrivate && (
                    <span className="profile-private-badge">
                      <Icon name="lock" size={12} /> Private
                    </span>
                  )}
                </div>
                <div className="profile-info-meta">Member since {formatMemberSince(profile.createdAt)}</div>
              </div>
            </div>

            {profile.isPrivate && !isMe ? (
              <div className="profile-private-notice">
                <Icon name="lock" size={28} />
                <strong>This profile is private</strong>
                <p>{profile.username} has chosen to keep their holdings and trade history hidden.</p>
              </div>
            ) : (
              <>
                {isMe && profile.isPrivate && (
                  <p className="settings-section-desc">
                    Your profile is private — only you can see the holdings and trades below. You can change
                    this in Settings.
                  </p>
                )}

                <div className="settings-divider" />

                <div className="settings-section">
                  <div className="settings-section-title">Holdings</div>
                  {profile.holdings.length === 0 ? (
                    <p className="empty-state">No holdings right now.</p>
                  ) : (
                    <div className="table-scroll">
                      <table className="holdings-table">
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th>Shares</th>
                            <th>Avg. cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.holdings.map((h) => (
                            <tr key={h.symbol}>
                              <td>
                                <strong>{h.symbol}</strong>
                                <div className="row-subtext">{h.name}</div>
                              </td>
                              <td>{h.shares}</td>
                              <td>${h.avgCost.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="settings-divider" />

                <div className="settings-section">
                  <div className="settings-section-title">Trade history</div>
                  {profile.transactions.length === 0 ? (
                    <p className="empty-state">No trades yet.</p>
                  ) : (
                    <TransactionHistory transactions={profile.transactions} />
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
