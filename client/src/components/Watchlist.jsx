import { useCallback, useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { fetchQuote } from '../lib/api.js';

const QUOTE_REFRESH_MS = 20000;

export default function Watchlist({ watchlist, loading, error, onRemove, onSelect }) {
  const [quotes, setQuotes] = useState({});

  const symbols = watchlist.map((w) => w.symbol);
  const symbolsKey = symbols.join(',');

  const refreshQuotes = useCallback(async (syms) => {
    if (syms.length === 0) return;
    const results = await Promise.allSettled(syms.map((s) => fetchQuote(s)));
    setQuotes((prev) => {
      const next = { ...prev };
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[syms[i]] = r.value;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    refreshQuotes(symbols);
    const interval = setInterval(() => refreshQuotes(symbols), QUOTE_REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, refreshQuotes]);

  if (loading) return <p className="empty-state">Loading your watchlist…</p>;
  if (error) return <div className="form-error">{error}</div>;
  if (watchlist.length === 0) {
    return (
      <p className="empty-state">
        Nothing on your watchlist yet. Search for a company or crypto on the Dashboard and tap "Watch" to add it.
      </p>
    );
  }

  return (
    <div className="table-scroll">
      <table className="holdings-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Current price</th>
            <th>Change</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {watchlist.map((w) => {
            const q = quotes[w.symbol];
            return (
              <tr key={w.symbol} className="clickable-row" onClick={() => onSelect(w.symbol, w.name)}>
                <td>
                  <strong>{w.symbol}</strong>
                  <div className="row-subtext">{w.name}</div>
                </td>
                <td>{q ? `$${q.price.toFixed(2)}` : '—'}</td>
                <td className={q && q.change >= 0 ? 'positive' : 'negative'}>
                  {q && q.change != null ? `${q.change >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%` : '—'}
                </td>
                <td>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${w.symbol} from watchlist`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(w.symbol);
                    }}
                  >
                    <Icon name="x" size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
