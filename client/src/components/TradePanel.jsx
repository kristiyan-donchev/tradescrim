import { useState } from 'react';
import Tooltip from './Tooltip.jsx';

const ORDER_TYPE_LABELS = {
  MARKET: 'market order',
  LIMIT: 'limit order',
  STOP: 'stop order',
  STOP_LIMIT: 'stop-limit order',
};

const ORDER_TYPE_TOOLTIPS = {
  MARKET: 'An order to buy or sell immediately at the current market price.',
  LIMIT: 'An order that only fills at your chosen price or better — it may not fill right away, or at all.',
  STOP: 'An order that becomes a market order once the price crosses your stop price.',
  STOP_LIMIT: 'An order that becomes a limit order once the price crosses your stop price.',
};

export default function TradePanel({ quote, holding, cash, onBuy, onSell, onPlaceOrder, error }) {
  const [inputMode, setInputMode] = useState('shares');
  const [shares, setShares] = useState('');
  const [amount, setAmount] = useState('');
  const [side, setSide] = useState('BUY');
  const [orderType, setOrderType] = useState('MARKET');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [placed, setPlaced] = useState(false);

  if (!quote) return null;

  const amountNum = Number(amount);
  const limitPriceNum = Number(limitPrice);
  const stopPriceNum = Number(stopPrice);

  const needsLimit = orderType === 'LIMIT' || orderType === 'STOP_LIMIT';
  const needsStop = orderType === 'STOP' || orderType === 'STOP_LIMIT';

  const referencePrice = orderType === 'STOP' ? stopPriceNum : needsLimit ? limitPriceNum : quote.price;

  // Dollar amounts are converted to shares up front, rounded down so the
  // resulting cost never exceeds what the user typed (or their cash on a buy).
  const sharesFromAmount =
    referencePrice > 0 && amountNum > 0 ? Math.floor((amountNum / referencePrice) * 1e6) / 1e6 : 0;
  const sharesNum = inputMode === 'amount' ? sharesFromAmount : Number(shares);

  const estimatedTotal = sharesNum > 0 && referencePrice > 0 ? sharesNum * referencePrice : 0;

  const canSubmit =
    sharesNum > 0 &&
    Number.isFinite(sharesNum) &&
    (!needsLimit || limitPriceNum > 0) &&
    (!needsStop || stopPriceNum > 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setPlaced(false);

    if (orderType === 'MARKET') {
      // No price sent here — the server fetches the live price itself for
      // market orders rather than trusting whatever this client last saw.
      const order = { symbol: quote.symbol, name: quote.name, shares: sharesNum };
      const ok = side === 'BUY' ? await onBuy(order) : await onSell(order);
      if (ok) {
        setShares('');
        setAmount('');
      }
      return;
    }

    const ok = await onPlaceOrder({
      symbol: quote.symbol,
      name: quote.name,
      side,
      orderType,
      shares: sharesNum,
      limitPrice: needsLimit ? limitPriceNum : null,
      stopPrice: needsStop ? stopPriceNum : null,
    });
    if (ok) {
      setShares('');
      setAmount('');
      setLimitPrice('');
      setStopPrice('');
      setPlaced(true);
    }
  }

  return (
    <form className="trade-panel" onSubmit={handleSubmit}>
      <h3>
        Place a simulated{' '}
        <Tooltip term={ORDER_TYPE_TOOLTIPS[orderType]}>{ORDER_TYPE_LABELS[orderType]}</Tooltip>
      </h3>

      <div className="trade-side-toggle">
        <button
          type="button"
          className={side === 'BUY' ? 'side-button buy active' : 'side-button buy'}
          onClick={() => setSide('BUY')}
        >
          Buy
        </button>
        <button
          type="button"
          className={side === 'SELL' ? 'side-button sell active' : 'side-button sell'}
          onClick={() => setSide('SELL')}
        >
          Sell
        </button>
      </div>

      <label className="field">
        <span>Order type</span>
        <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
          <option value="MARKET">Market</option>
          <option value="LIMIT">Limit</option>
          <option value="STOP">Stop</option>
          <option value="STOP_LIMIT">Stop-limit</option>
        </select>
      </label>

      <div className="range-tabs">
        <button
          type="button"
          className={inputMode === 'shares' ? 'range-tab active' : 'range-tab'}
          onClick={() => setInputMode('shares')}
        >
          Shares
        </button>
        <button
          type="button"
          className={inputMode === 'amount' ? 'range-tab active' : 'range-tab'}
          onClick={() => setInputMode('amount')}
        >
          Dollar amount
        </button>
      </div>

      {inputMode === 'shares' ? (
        <label className="field">
          <span>Shares</span>
          <input
            type="number"
            min="0"
            step="any"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder="0"
          />
        </label>
      ) : (
        <label className="field">
          <span>Amount ($)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          {amountNum > 0 && (
            <span className="field-hint">
              ≈ {sharesFromAmount > 0 ? sharesFromAmount : 0} share(s) at ${referencePrice.toFixed(2)}
            </span>
          )}
        </label>
      )}

      {needsStop && (
        <label className="field">
          <span>Stop price</span>
          <input
            type="number"
            min="0"
            step="any"
            value={stopPrice}
            onChange={(e) => setStopPrice(e.target.value)}
            placeholder="0.00"
          />
        </label>
      )}

      {needsLimit && (
        <label className="field">
          <span>Limit price</span>
          <input
            type="number"
            min="0"
            step="any"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="0.00"
          />
        </label>
      )}

      <div className="trade-meta">
        <div>
          Current price: <strong>${quote.price.toFixed(2)}</strong>
        </div>
        <div>
          Estimated {side === 'BUY' ? 'cost' : 'proceeds'}
          {orderType !== 'MARKET' ? ' if filled' : ''}: <strong>${estimatedTotal.toFixed(2)}</strong>
        </div>
        {side === 'BUY' && (
          <div>
            Virtual cash available: <strong>${cash.toFixed(2)}</strong>
          </div>
        )}
        {side === 'SELL' && (
          <div>
            You own: <strong>{holding ? holding.shares : 0} share(s)</strong>
          </div>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}
      {placed && <div className="form-success">Order placed — track it in "Open orders" below.</div>}

      <button type="submit" className="primary-button" disabled={!canSubmit}>
        {orderType === 'MARKET'
          ? `${side === 'BUY' ? 'Buy' : 'Sell'} ${sharesNum > 0 ? sharesNum : 0} share(s) of ${quote.symbol}`
          : `Place ${side === 'BUY' ? 'buy' : 'sell'} ${ORDER_TYPE_LABELS[orderType]}`}
      </button>
      <p className="disclaimer-inline">Simulated only — no real money or brokerage is involved.</p>
    </form>
  );
}
