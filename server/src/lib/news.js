import { yahooFinance } from './yahoo.js';

// Yahoo Finance has no dedicated "general market news" endpoint — search()
// with a broad query and quotesCount: 0 is the standard way to pull a general
// news feed out of it (the same call Yahoo's own homepage news rail is
// built from), rather than news scoped to one ticker.
const MARKET_NEWS_QUERY = 'stock market';

export async function getMarketNews(count = 100) {
  const result = await yahooFinance.search(MARKET_NEWS_QUERY, { newsCount: count, quotesCount: 0 });
  const items = (result.news || []).map((item) => ({
    uuid: item.uuid,
    title: item.title,
    publisher: item.publisher,
    link: item.link,
    publishedAt: item.providerPublishTime ? new Date(item.providerPublishTime).getTime() : null,
    thumbnailUrl: item.thumbnail?.resolutions?.[0]?.url ?? null,
    relatedTickers: item.relatedTickers || [],
  }));
  // Yahoo's search endpoint doesn't guarantee recency order, so sort explicitly
  // (undated items sink to the bottom rather than interrupting the timeline).
  items.sort((a, b) => (b.publishedAt ?? -Infinity) - (a.publishedAt ?? -Infinity));
  return items;
}
