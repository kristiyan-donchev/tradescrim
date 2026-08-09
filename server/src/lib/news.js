import { yahooFinance } from './yahoo.js';

// Yahoo Finance has no dedicated "general market news" endpoint — search()
// with a broad query and quotesCount: 0 is the standard way to pull a general
// news feed out of it (the same call Yahoo's own homepage news rail is
// built from), rather than news scoped to one ticker.
//
// The endpoint also hard-caps the news array at ~10 results NO MATTER what
// newsCount is set to (confirmed directly: requesting 100 still returns 10) —
// it's a "search suggestions" endpoint with a small news preview bolted on,
// not a real paginated feed. To get a feed with real depth, fan out across
// several broad queries in parallel and merge/dedupe the results instead of
// relying on a single query's capped response.
const MARKET_NEWS_QUERIES = [
  'stock market',
  'stocks',
  'S&P 500',
  'Nasdaq',
  'Dow Jones',
  'earnings',
  'Federal Reserve',
  'crypto',
];

export async function getMarketNews() {
  const results = await Promise.allSettled(
    MARKET_NEWS_QUERIES.map((query) => yahooFinance.search(query, { newsCount: 10, quotesCount: 0 }))
  );

  const byId = new Map();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value.news || []) {
      const id = item.uuid || item.link;
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        uuid: id,
        title: item.title,
        publisher: item.publisher,
        link: item.link,
        publishedAt: item.providerPublishTime ? new Date(item.providerPublishTime).getTime() : null,
        thumbnailUrl: item.thumbnail?.resolutions?.[0]?.url ?? null,
        relatedTickers: item.relatedTickers || [],
      });
    }
  }

  // Yahoo's search endpoint doesn't guarantee recency order, so sort explicitly
  // (undated items sink to the bottom rather than interrupting the timeline).
  return Array.from(byId.values()).sort((a, b) => (b.publishedAt ?? -Infinity) - (a.publishedAt ?? -Infinity));
}
