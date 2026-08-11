import { describe, expect, it } from 'vitest';
import { computeNewAvgCost, computeRealizedPnL, computeRemainingShares } from './costBasis.js';

describe('computeNewAvgCost', () => {
  it('uses the buy price directly for a brand-new position', () => {
    expect(computeNewAvgCost(0, 0, 10, 50)).toBe(50);
  });

  it('weights the average by shares when adding to an existing position', () => {
    // 5 @ $100 then 5 @ $120 -> (500 + 600) / 10 = $110
    expect(computeNewAvgCost(5, 100, 5, 120)).toBe(110);
  });

  it('handles unequal buy sizes', () => {
    // 10 @ $50 then 2 @ $80 -> (500 + 160) / 12
    expect(computeNewAvgCost(10, 50, 2, 80)).toBeCloseTo(55, 10);
  });

  it('is unaffected by adding at exactly the existing average cost', () => {
    expect(computeNewAvgCost(3, 75, 7, 75)).toBe(75);
  });

  it('handles fractional shares (e.g. crypto)', () => {
    // 0.001 @ 60000 then 0.002 @ 90000 -> (60 + 180) / 0.003 = 80000
    expect(computeNewAvgCost(0.001, 60000, 0.002, 90000)).toBeCloseTo(80000, 6);
  });
});

describe('computeRealizedPnL', () => {
  it('is positive when selling above cost basis', () => {
    expect(computeRealizedPnL(100, 10, 120)).toBe(200);
  });

  it('is negative when selling below cost basis', () => {
    expect(computeRealizedPnL(100, 10, 90)).toBe(-100);
  });

  it('is zero when selling at exactly cost basis', () => {
    expect(computeRealizedPnL(50, 20, 50)).toBe(0);
  });

  it('scales with the number of shares sold, not the full position', () => {
    // Only sell half of a 10-share position bought at 100, at 150 -> $250, not $500
    expect(computeRealizedPnL(100, 5, 150)).toBe(250);
  });
});

describe('computeRemainingShares', () => {
  it('subtracts the sold amount from the existing position', () => {
    expect(computeRemainingShares(10, 4)).toBe(6);
  });

  it('floors a full sell to exactly 0 despite float noise', () => {
    // Classic float trap: 0.3 - 0.1 - 0.1 - 0.1 !== 0 in IEEE754
    const remaining = computeRemainingShares(0.3, 0.1 + 0.1 + 0.1);
    expect(remaining).toBe(0);
  });

  it('leaves a partial position untouched by the flooring', () => {
    expect(computeRemainingShares(10, 3)).toBe(7);
  });
});
