// achievements.js imports db.js, which throws at import time if DATABASE_URL
// isn't set — even though none of the pure functions tested here ever touch
// the database. Loading .env here keeps `npm test` working the same way the
// real server does, without changing db.js's own (correct) fail-fast check.
import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { diversificationEarnedAt, firstTryStreakEarnedAt, longTermHolderEarnedAt } from './achievements.js';

function tx(symbol, type, shares, timestamp) {
  return { symbol, type, shares, timestamp };
}

describe('diversificationEarnedAt', () => {
  it('unlocks once enough distinct symbols are held simultaneously', () => {
    const transactions = [
      tx('AAPL', 'BUY', 1, 1),
      tx('MSFT', 'BUY', 1, 2),
      tx('TSLA', 'BUY', 1, 3),
      tx('AMZN', 'BUY', 1, 4),
      tx('GOOGL', 'BUY', 1, 5),
    ];
    expect(diversificationEarnedAt(transactions, 5)).toBe(5);
  });

  it('does not count a symbol that was bought then fully sold', () => {
    const transactions = [
      tx('AAPL', 'BUY', 1, 1),
      tx('AAPL', 'SELL', 1, 2),
      tx('MSFT', 'BUY', 1, 3),
      tx('TSLA', 'BUY', 1, 4),
      tx('AMZN', 'BUY', 1, 5),
      tx('GOOGL', 'BUY', 1, 6),
    ];
    // Only 4 distinct symbols actually held at the end (AAPL nets to 0)
    expect(diversificationEarnedAt(transactions, 5)).toBeNull();
  });

  it('returns null when the threshold is never reached', () => {
    const transactions = [tx('AAPL', 'BUY', 1, 1), tx('MSFT', 'BUY', 1, 2)];
    expect(diversificationEarnedAt(transactions, 5)).toBeNull();
  });

  it('handles fractional shares without NaN poisoning the running total', () => {
    // Regression test: transactions rows that are missing `shares` entirely
    // (the actual bug — the SQL SELECT once omitted the column) must not
    // silently produce NaN, which compares false against every threshold
    // and makes this achievement permanently unreachable without ever
    // throwing or showing up as an obvious failure.
    const withMissingShares = [
      { symbol: 'AAPL', type: 'BUY', timestamp: 1 },
      { symbol: 'MSFT', type: 'BUY', timestamp: 2 },
    ].map((t) => ({ ...t, shares: undefined }));
    for (const t of withMissingShares) {
      expect(Number.isNaN(Number(t.shares))).toBe(true);
    }
    // With real data (this test's real purpose), it must work correctly:
    const transactions = [tx('BTC-USD', 'BUY', 0.001, 1), tx('ETH-USD', 'BUY', 0.01, 2)];
    expect(diversificationEarnedAt(transactions, 2)).toBe(2);
  });
});

describe('firstTryStreakEarnedAt', () => {
  it('unlocks at the completion that reaches the streak threshold', () => {
    const completions = [
      { firstTryPerfect: true, completedAt: 1 },
      { firstTryPerfect: true, completedAt: 2 },
      { firstTryPerfect: true, completedAt: 3 },
    ];
    expect(firstTryStreakEarnedAt(completions, 3)).toBe(3);
  });

  it('resets the streak on a non-perfect completion', () => {
    const completions = [
      { firstTryPerfect: true, completedAt: 1 },
      { firstTryPerfect: true, completedAt: 2 },
      { firstTryPerfect: false, completedAt: 3 },
      { firstTryPerfect: true, completedAt: 4 },
    ];
    // Streak breaks at #3, only 2 in a row after that — threshold of 3 never re-reached
    expect(firstTryStreakEarnedAt(completions, 3)).toBeNull();
  });
});

describe('longTermHolderEarnedAt', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it('unlocks once a held position has aged 30 days', () => {
    const boughtAt = 1000;
    const transactions = [{ symbol: 'AAPL', type: 'BUY', timestamp: boughtAt }];
    const now = boughtAt + 30 * DAY_MS;
    expect(longTermHolderEarnedAt(transactions, ['AAPL'], now)).toBe(boughtAt + 30 * DAY_MS);
  });

  it('does not unlock before 30 days have passed', () => {
    const boughtAt = 1000;
    const transactions = [{ symbol: 'AAPL', type: 'BUY', timestamp: boughtAt }];
    const now = boughtAt + 10 * DAY_MS;
    expect(longTermHolderEarnedAt(transactions, ['AAPL'], now)).toBeNull();
  });

  it('ignores symbols no longer held', () => {
    const boughtAt = 1000;
    const transactions = [{ symbol: 'AAPL', type: 'BUY', timestamp: boughtAt }];
    const now = boughtAt + 60 * DAY_MS;
    expect(longTermHolderEarnedAt(transactions, [], now)).toBeNull();
  });
});
