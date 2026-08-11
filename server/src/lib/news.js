const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// A small, liquid pool used only to fan out company-news requests (see
// below) — separate from games.js's CHART_POOL to avoid a circular import,
// since games.js itself imports getMarketNews from this file.
const NEWS_TICKER_POOL = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX',
  'JPM', 'V', 'WMT', 'DIS', 'KO', 'XOM', 'JNJ',
];

// Finnhub's /news (category=general) endpoint gives broad market headlines
// but its `related` field is essentially always empty — general news isn't
// scoped to a company. Bull or Bear needs articles tied to a tradable
// symbol, so a handful of /company-news requests are mixed in on top,
// manually tagged with the symbol they were fetched for.
const COMPANY_NEWS_FANOUT = 6;
const COMPANY_NEWS_LOOKBACK_DAYS = 5;

// Results are the same for every visitor, and Finnhub's free tier caps at
// 60 requests/minute — without caching, a company-news fan-out on every
// single News tab load or Bull or Bear round would burn through that budget
// almost immediately. A short shared cache keeps real request volume low
// regardless of how many users hit the endpoint in that window.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { data: null, expiresAt: 0 };

function requireApiKey() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new Error(
      'News is unavailable: FINNHUB_API_KEY is not set. Get a free key at https://finnhub.io/register.'
    );
  }
  return key;
}

function toDateParam(date) {
  return date.toISOString().slice(0, 10);
}

function mapArticle(item, { relatedTickers } = {}) {
  const id = item.id != null ? String(item.id) : item.url;
  if (!id) return null;
  return {
    uuid: id,
    title: item.headline,
    publisher: item.source,
    link: item.url,
    publishedAt: item.datetime ? item.datetime * 1000 : null,
    thumbnailUrl: item.image || null,
    relatedTickers: relatedTickers || (item.related ? item.related.split(',').filter(Boolean) : []),
  };
}

async function fetchGeneralNews(apiKey) {
  const res = await fetch(`${FINNHUB_BASE}/news?category=general&token=${apiKey}`);
  if (!res.ok) throw new Error(`Finnhub general news request failed (${res.status})`);
  const items = await res.json();
  return (items || []).map((item) => mapArticle(item)).filter(Boolean);
}

async function fetchCompanyNews(symbol, apiKey) {
  const to = new Date();
  const from = new Date(to.getTime() - COMPANY_NEWS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const url = `${FINNHUB_BASE}/company-news?symbol=${symbol}&from=${toDateParam(from)}&to=${toDateParam(to)}&token=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub company news request failed for ${symbol} (${res.status})`);
  const items = await res.json();
  return (items || []).map((item) => mapArticle(item, { relatedTickers: [symbol] })).filter(Boolean);
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function getMarketNews() {
  if (cache.data && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  const apiKey = requireApiKey();
  const symbols = shuffle(NEWS_TICKER_POOL).slice(0, COMPANY_NEWS_FANOUT);
  const results = await Promise.allSettled([
    fetchGeneralNews(apiKey),
    ...symbols.map((symbol) => fetchCompanyNews(symbol, apiKey)),
  ]);

  const byId = new Map();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const article of result.value) {
      if (!byId.has(article.uuid)) byId.set(article.uuid, article);
    }
  }

  // Every request failed (e.g. a bad/rate-limited key) — surface an error
  // instead of silently caching and returning an empty feed.
  if (byId.size === 0 && results.every((r) => r.status === 'rejected')) {
    throw new Error('Could not load market news right now.');
  }

  const articles = Array.from(byId.values()).sort((a, b) => (b.publishedAt ?? -Infinity) - (a.publishedAt ?? -Infinity));
  cache = { data: articles, expiresAt: Date.now() + CACHE_TTL_MS };
  return articles;
}
