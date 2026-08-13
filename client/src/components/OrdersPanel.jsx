import { Icon } from './icons.jsx';

const ORDER_TYPE_LABELS = { LIMIT: 'Limit', STOP: 'Stop', STOP_LIMIT: 'Stop-limit' };
const STATUS_LABELS = { PENDING: 'Pending', FILLED: 'Filled', CANCELLED: 'Cancelled' };

function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function priceSummary(order) {
  if (order.orderType === 'LIMIT') return `limit $${order.limitPrice.toFixed(2)}`;
  if (order.orderType === 'STOP') return `stop $${order.stopPrice.toFixed(2)}`;
  return `stop $${order.stopPrice.toFixed(2)} / limit $${order.limitPrice.toFixed(2)}`;
}

export default function OrdersPanel({ orders, loading, error, onCancel }) {
  if (loading) return <p className="empty-state">Loading orders…</p>;
  if (error) return <div className="form-error">{error}</div>;
  if (orders.length === 0) {
    return <p className="empty-state">No limit, stop, or stop-limit orders yet — place one from the trade panel above.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="holdings-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Side</th>
            <th>Type</th>
            <th>Shares</th>
            <th>Trigger</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>{o.symbol}</strong>
                <div className="row-subtext">{formatDate(o.createdAt)}</div>
              </td>
              <td className={o.side === 'BUY' ? 'positive' : 'negative'}>{o.side}</td>
              <td>{ORDER_TYPE_LABELS[o.orderType]}</td>
              <td>{o.shares}</td>
              <td>{priceSummary(o)}</td>
              <td>
                <span className={`order-status ${o.status.toLowerCase()}`}>{STATUS_LABELS[o.status]}</span>
                {o.status === 'FILLED' && (
                  <div className="row-subtext">at ${o.filledPrice?.toFixed(2)}</div>
                )}
                {o.status === 'CANCELLED' && o.cancelReason && <div className="row-subtext">{o.cancelReason}</div>}
              </td>
              <td>
                {o.status === 'PENDING' && (
                  <button type="button" className="icon-button" aria-label="Cancel order" onClick={() => onCancel(o.id)}>
                    <Icon name="x" size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
