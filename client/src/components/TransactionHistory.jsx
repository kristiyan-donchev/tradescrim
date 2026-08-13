export default function TransactionHistory({ transactions }) {
  if (transactions.length === 0) {
    return <p className="empty-state">No trades yet — your transaction history will show up here.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="transactions-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Symbol</th>
            <th>Shares</th>
            <th>Price</th>
            <th>Total</th>
            <th>Realized P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td>{new Date(t.timestamp).toLocaleString()}</td>
              <td className={t.type === 'BUY' ? 'positive' : 'negative-neutral'}>{t.type}</td>
              <td>{t.symbol}</td>
              <td>{t.shares}</td>
              <td>${t.price.toFixed(2)}</td>
              <td>${t.total.toFixed(2)}</td>
              <td className={t.realizedPnL == null ? '' : t.realizedPnL >= 0 ? 'positive' : 'negative'}>
                {t.realizedPnL == null ? '—' : `${t.realizedPnL >= 0 ? '+' : ''}$${t.realizedPnL.toFixed(2)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
