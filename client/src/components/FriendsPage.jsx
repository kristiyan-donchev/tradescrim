import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import {
  fetchFriends,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  unfriend,
} from '../lib/api.js';

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FriendsPage() {
  const [overview, setOverview] = useState({ friends: [], incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [username, setUsername] = useState('');
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchFriends()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSending(true);
    try {
      const result = await sendFriendRequest(username.trim());
      setFormSuccess(
        result.status === 'ACCEPTED' ? `You and ${username.trim()} are now friends!` : `Friend request sent to ${username.trim()}.`
      );
      setUsername('');
      setOverview(await fetchFriends());
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleAccept(id) {
    try {
      setOverview(await acceptFriendRequest(id));
    } catch (err) {
      setLoadError(err.message);
    }
  }

  async function handleDecline(id) {
    try {
      setOverview(await declineFriendRequest(id));
    } catch (err) {
      setLoadError(err.message);
    }
  }

  async function handleUnfriend(userId, username) {
    if (!window.confirm(`Remove ${username} as a friend? You'll need to send a new request to re-add them.`)) return;
    try {
      setOverview(await unfriend(userId));
    } catch (err) {
      setLoadError(err.message);
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Add a friend</h2>
        <form className="alert-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <button type="submit" className="secondary-button" disabled={sending || !username.trim()}>
            {sending ? 'Sending…' : 'Send request'}
          </button>
        </form>
        {formError && <div className="form-error">{formError}</div>}
        {formSuccess && <div className="form-success">{formSuccess}</div>}
      </section>

      {loading && <p className="empty-state">Loading your friends…</p>}
      {loadError && <div className="form-error">{loadError}</div>}

      {!loading && !loadError && (
        <>
          {overview.incoming.length > 0 && (
            <section className="panel">
              <h2>Friend requests</h2>
              <div className="alerts-list">
                {overview.incoming.map((r) => (
                  <div className="alert-row" key={r.id}>
                    <span>
                      <strong>{r.username}</strong> wants to be friends
                    </span>
                    <div className="row-actions">
                      <button type="button" className="secondary-button" onClick={() => handleAccept(r.id)}>
                        Accept
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Decline ${r.username}'s request`}
                        onClick={() => handleDecline(r.id)}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {overview.outgoing.length > 0 && (
            <section className="panel">
              <h2>Sent requests</h2>
              <div className="alerts-list">
                {overview.outgoing.map((r) => (
                  <div className="alert-row" key={r.id}>
                    <span>
                      Request sent to <strong>{r.username}</strong>
                    </span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Cancel request to ${r.username}`}
                      onClick={() => handleDecline(r.id)}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel">
            <h2>Friends</h2>
            {overview.friends.length === 0 ? (
              <p className="empty-state">
                No friends yet — send a request above, or ask a friend to send you one.
              </p>
            ) : (
              <div className="alerts-list">
                {overview.friends.map((f) => (
                  <div className="alert-row" key={f.id}>
                    <span>
                      <strong>{f.username}</strong>
                      <span className="row-subtext"> friends since {formatDate(f.createdAt)}</span>
                    </span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${f.username} as a friend`}
                      onClick={() => handleUnfriend(f.userId, f.username)}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
