import Tooltip from './Tooltip.jsx';

export default function HoldingsTable({ holdings, quotes, onSelect }) {
  const rows = Object.values(holdings);

  if (rows.length === 0) {
    return <p className="empty-state">You don't own any shares yet. Search for a ticker above to get started.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="holdings-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Shares</th>
            <th>
              <Tooltip term="What you originally paid, on average, per share.">Avg. cost</Tooltip>
            </th>
            <th>Current price</th>
            <th>Market value</th>
            <th>
              <Tooltip term="Profit or loss on shares you still hold, based on the current price. Not locked in until you sell.">
                Unrealized P&amp;L
              </Tooltip>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const quote = quotes[h.symbol];
            const price = quote ? quote.price : null;
            const marketValue = price != null ? price * h.shares : null;
            const unrealized = price != null ? (price - h.avgCost) * h.shares : null;
            return (
              <tr key={h.symbol} onClick={() => onSelect(h.symbol, h.name)} className="clickable-row">
                <td>
                  <strong>{h.symbol}</strong>
                  <div className="row-subtext">{h.name}</div>
                </td>
                <td>{h.shares}</td>
                <td>${h.avgCost.toFixed(2)}</td>
                <td>{price != null ? `$${price.toFixed(2)}` : '—'}</td>
                <td>{marketValue != null ? `$${marketValue.toFixed(2)}` : '—'}</td>
                <td className={unrealized >= 0 ? 'positive' : 'negative'}>
                  {unrealized != null
                    ? `${unrealized >= 0 ? '+' : ''}$${unrealized.toFixed(2)}`
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
