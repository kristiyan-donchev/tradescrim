import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const RANGES = ['1d', '1w', '1mo', '3mo', '6mo', '1y', 'all'];
const RANGE_LABELS = { '1d': '1D', '1w': '1W', '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y', all: 'All' };

const CATEGORIES = [
  { key: 'return', label: 'Return', metricLabel: 'ROI', timeScoped: true },
  { key: 'active', label: 'Most Active', metricLabel: 'Trades', timeScoped: true },
  { key: 'biggest_win', label: 'Biggest Win', metricLabel: 'Best sale', timeScoped: true },
  { key: 'diversified', label: 'Most Diversified', metricLabel: 'Holdings', timeScoped: false },
];

function MetricCell({ category, entry }) {
  if (category === 'return') {
    return (
      <td className={entry.roiPercent >= 0 ? 'positive' : 'negative'}>
        {entry.roiPercent >= 0 ? '+' : ''}
        {entry.roiPercent.toFixed(2)}%
      </td>
    );
  }
  if (category === 'active') {
    return <td>{entry.tradeCount}</td>;
  }
  if (category === 'biggest_win') {
    return (
      <td className={entry.bestWin > 0 ? 'positive' : 'negative-neutral'}>
        {entry.bestWin > 0 ? `+$${entry.bestWin.toFixed(2)} (${entry.bestWinSymbol})` : '—'}
      </td>
    );
  }
  return <td>{entry.holdingCount}</td>;
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [category, setCategory] = useState('return');
  const [range, setRange] = useState('1mo');
  const [scope, setScope] = useState('global');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const categoryMeta = CATEGORIES.find((c) => c.key === category);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    fetchLeaderboard(range, category, scope)
      .then((d) => {
        if (!cancelled) setEntries(d.leaderboard || []);
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
  }, [range, category, scope]);

  return (
    <div className="leaderboard">
      <div className="range-tabs">
        <button
          className={scope === 'global' ? 'range-tab active' : 'range-tab'}
          onClick={() => setScope('global')}
        >
          Global
        </button>
        <button
          className={scope === 'friends' ? 'range-tab active' : 'range-tab'}
          onClick={() => setScope('friends')}
          disabled={!user}
          title={user ? undefined : 'Log in to see your friends leaderboard.'}
        >
          Friends
        </button>
      </div>

      <div className="range-tabs category-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={c.key === category ? 'range-tab active' : 'range-tab'}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {categoryMeta.timeScoped && (
        <div className="range-tabs">
          {RANGES.map((r) => (
            <button key={r} className={r === range ? 'range-tab active' : 'range-tab'} onClick={() => setRange(r)}>
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="chart-status">Loading leaderboard…</div>}
      {errorMsg && <div className="chart-status error">{errorMsg}</div>}
      {!loading && !errorMsg && entries.length > 0 && (
        <div className="table-scroll">
          <table className="holdings-table leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Trader</th>
                <th>{categoryMeta.metricLabel}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isMe = user && entry.userId === user.id;
                return (
                  <tr key={entry.userId} className={isMe ? 'leaderboard-row-me' : ''}>
                    <td className="leaderboard-rank">#{entry.rank}</td>
                    <td>
                      {entry.username}
                      {isMe && ' (you)'}
                    </td>
                    <MetricCell category={category} entry={entry} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !errorMsg && entries.length === 0 && <p className="empty-state">No traders to rank yet.</p>}
    </div>
  );
}
