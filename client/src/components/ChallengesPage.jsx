import { useEffect, useState } from 'react';
import { fetchChallenges, createChallenge, joinChallenge, fetchChallengeStandings } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from './icons.jsx';

const DURATIONS = [
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
];

const BADGES = {
  WINNER: { icon: 'trophy', label: 'Winner' },
  TOP_3: { icon: 'medal', label: 'Top 3' },
  PARTICIPANT: { icon: 'target', label: 'Participant' },
};

function BadgeLabel({ badge }) {
  const meta = BADGES[badge];
  if (!meta) return badge;
  return (
    <>
      <Icon name={meta.icon} size={14} /> {meta.label}
    </>
  );
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StandingsView({ challengeId, onBack }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchChallengeStandings(challengeId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [challengeId]);

  return (
    <section className="panel">
      <button type="button" className="icon-button" aria-label="Back to challenges" onClick={onBack}>
        <Icon name="arrow-left" size={16} /> Back
      </button>
      {loading && <p className="empty-state">Loading standings…</p>}
      {error && <div className="form-error">{error}</div>}
      {data && (
        <>
          <h2>{data.challenge.title}</h2>
          {data.challenge.description && <p className="tagline">{data.challenge.description}</p>}
          <p className="row-subtext">
            {data.finalized ? 'Final standings' : 'Live standings'} — ends {formatDate(data.challenge.endsAt)}
          </p>
          {data.standings.length === 0 ? (
            <p className="empty-state">No participants yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="holdings-table leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Trader</th>
                    <th>ROI</th>
                    {data.finalized && <th>Badge</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.standings.map((entry) => {
                    const isMe = user && entry.userId === user.id;
                    return (
                      <tr key={entry.userId} className={isMe ? 'leaderboard-row-me' : ''}>
                        <td className="leaderboard-rank">#{entry.rank}</td>
                        <td>
                          {entry.username}
                          {isMe && ' (you)'}
                        </td>
                        <td className={entry.roiPercent >= 0 ? 'positive' : 'negative'}>
                          {entry.roiPercent >= 0 ? '+' : ''}
                          {entry.roiPercent.toFixed(2)}%
                        </td>
                        {data.finalized && (
                          <td>
                            <BadgeLabel badge={entry.badge} />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function ChallengesPage() {
  const [overview, setOverview] = useState({ open: [], active: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [formError, setFormError] = useState(null);
  const [creating, setCreating] = useState(false);

  function load() {
    return fetchChallenges()
      .then((data) => setOverview(data))
      .catch((err) => setLoadError(err.message));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const data = await createChallenge({ title: title.trim(), description: description.trim(), durationDays });
      setOverview(data);
      setTitle('');
      setDescription('');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(id) {
    try {
      setOverview(await joinChallenge(id));
    } catch (err) {
      setLoadError(err.message);
    }
  }

  if (selectedId != null) {
    return <StandingsView challengeId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <>
      <section className="panel">
        <h2>Start a challenge</h2>
        <p className="row-subtext">
          Invite your friends to a head-to-head ROI competition — visible to you and your current friends.
        </p>
        <form className="alert-form" onSubmit={handleCreate}>
          <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <select value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d.days} value={d.days}>
                {d.label}
              </option>
            ))}
          </select>
          <button type="submit" className="secondary-button" disabled={creating || !title.trim()}>
            {creating ? 'Creating…' : 'Create challenge'}
          </button>
        </form>
        {formError && <div className="form-error">{formError}</div>}
      </section>

      {loading && <p className="empty-state">Loading challenges…</p>}
      {loadError && <div className="form-error">{loadError}</div>}

      {!loading && !loadError && (
        <>
          {overview.open.length > 0 && (
            <section className="panel">
              <h2>Open to join</h2>
              <div className="alerts-list">
                {overview.open.map((c) => (
                  <div className="alert-row" key={c.id}>
                    <span>
                      <strong>{c.title}</strong>
                      <span className="row-subtext">
                        {' '}
                        by {c.creatorUsername} — ends {formatDate(c.endsAt)}
                      </span>
                    </span>
                    <button type="button" className="secondary-button" onClick={() => handleJoin(c.id)}>
                      Join
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel">
            <h2>Active</h2>
            {overview.active.length === 0 ? (
              <p className="empty-state">No active challenges — create one above or join one you're eligible for.</p>
            ) : (
              <div className="alerts-list">
                {overview.active.map((c) => (
                  <div className="alert-row clickable-row" key={c.id} onClick={() => setSelectedId(c.id)}>
                    <span>
                      <strong>{c.title}</strong>
                      <span className="row-subtext"> ends {formatDate(c.endsAt)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {overview.past.length > 0 && (
            <section className="panel">
              <h2>Past</h2>
              <div className="alerts-list">
                {overview.past.map((c) => (
                  <div className="alert-row clickable-row" key={c.id} onClick={() => setSelectedId(c.id)}>
                    <span>
                      <strong>{c.title}</strong>
                      <span className="row-subtext"> ended {formatDate(c.endsAt)}</span>
                    </span>
                    <span>{c.badge ? <BadgeLabel badge={c.badge} /> : 'Scoring…'}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
