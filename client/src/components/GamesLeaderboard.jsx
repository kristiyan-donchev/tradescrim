import { useEffect, useState } from 'react';
import { fetchGamesLeaderboard } from '../lib/api.js';
import { GAMES_META } from '../lib/games.js';
import { useAuth } from '../context/AuthContext.jsx';

// Games without a numeric score (e.g. the Investor Personality Quiz, which
// produces a "type" instead) don't have a leaderboard to show.
const RANKABLE_GAMES = GAMES_META.filter((g) => g.hasLeaderboard !== false);

export default function GamesLeaderboard() {
  const { user } = useAuth();
  const [gameId, setGameId] = useState(RANKABLE_GAMES[0].id);
  const [scope, setScope] = useState('global');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const game = RANKABLE_GAMES.find((g) => g.id === gameId);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    fetchGamesLeaderboard(gameId, scope)
      .then((entries) => {
        if (!cancelled) setEntries(entries);
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
  }, [gameId, scope]);

  return (
    <div className="leaderboard">
      <div className="range-tabs">
        {RANKABLE_GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            className={g.id === gameId ? 'range-tab active' : 'range-tab'}
            onClick={() => setGameId(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="range-tabs">
        <button
          type="button"
          className={scope === 'global' ? 'range-tab active' : 'range-tab'}
          onClick={() => setScope('global')}
        >
          Global
        </button>
        <button
          type="button"
          className={scope === 'friends' ? 'range-tab active' : 'range-tab'}
          onClick={() => setScope('friends')}
          disabled={!user}
          title={user ? undefined : 'Log in to see your friends leaderboard.'}
        >
          Friends
        </button>
      </div>

      {loading && <div className="chart-status">Loading leaderboard…</div>}
      {errorMsg && <div className="chart-status error">{errorMsg}</div>}
      {!loading && !errorMsg && entries.length > 0 && (
        <div className="table-scroll">
          <table className="holdings-table leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>{game.scoreLabel}</th>
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
                    <td>{game.formatScore(entry.bestScore)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !errorMsg && entries.length === 0 && (
        <p className="empty-state">
          {scope === 'friends'
            ? "None of your friends have played this game yet."
            : 'Nobody has played this game yet — be the first.'}
        </p>
      )}
    </div>
  );
}
