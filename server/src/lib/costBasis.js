// Pure, DB-free money math shared by buyShares/sellShares in portfolio.js —
// split out specifically so it can be unit tested without a database, since
// a silent drift here means every user's holdings and P&L quietly go wrong.

// Weighted-average cost basis after adding `addedShares` at `price` to an
// existing position. `existingShares` of 0 (a brand-new position) collapses
// to just `price`, same as the inline version this replaced.
export function computeNewAvgCost(existingShares, existingAvgCost, addedShares, price) {
  const newShares = existingShares + addedShares;
  if (existingShares <= 0) return price;
  return (existingAvgCost * existingShares + price * addedShares) / newShares;
}

// Realized profit/loss on selling `soldShares` at `price`, against a
// position with average cost `avgCost`. Negative when sold below cost.
export function computeRealizedPnL(avgCost, soldShares, price) {
  return (price - avgCost) * soldShares;
}

// Remaining share count after a sell, floored at 0 to absorb float noise
// from repeated fractional buys/sells (e.g. crypto) landing a hair below
// zero instead of exactly at it.
export function computeRemainingShares(existingShares, soldShares) {
  const remaining = existingShares - soldShares;
  return Math.abs(remaining) < 1e-9 ? 0 : remaining;
}
