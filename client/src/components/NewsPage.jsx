import { useEffect, useState } from 'react';
import { fetchMarketNews } from '../lib/api.js';

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchMarketNews()
      .then((items) => {
        if (!cancelled) setNews(items);
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
  }, []);

  return (
    <section className="panel">
      <h2>Latest headlines</h2>
      {loading && <p className="empty-state">Loading market news…</p>}
      {error && <div className="form-error">{error}</div>}
      {!loading && !error && news.length === 0 && <p className="empty-state">No news available right now.</p>}

      {!loading && !error && news.length > 0 && (
        <div className="news-list">
          {news.map((item) => (
            <a className="news-card" key={item.uuid} href={item.link} target="_blank" rel="noopener noreferrer">
              {item.thumbnailUrl && (
                <img className="news-thumbnail" src={item.thumbnailUrl} alt={item.title} loading="lazy" />
              )}
              <div className="news-card-body">
                <h3 className="news-title">{item.title}</h3>
                <div className="news-meta">
                  {item.publisher}
                  {item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ''}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
