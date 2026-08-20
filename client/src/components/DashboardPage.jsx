import { lazy, Suspense } from 'react';
import SearchBar from './SearchBar.jsx';
import { Icon } from './icons.jsx';
import PortfolioBreakdown from './PortfolioBreakdown.jsx';
import TradePanel from './TradePanel.jsx';
import OrdersPanel from './OrdersPanel.jsx';
import CreateAlertForm from './CreateAlertForm.jsx';
import PortfolioSummary from './PortfolioSummary.jsx';
import HoldingsTable from './HoldingsTable.jsx';
import TransactionHistory from './TransactionHistory.jsx';
import GuestGate from './GuestGate.jsx';
import { useOrders } from '../hooks/useOrders.js';
import { useWatchlist } from '../hooks/useWatchlist.js';
import { STARTING_CASH, totalRealizedPnL } from '../lib/portfolio.js';

// recharts is the app's single heaviest dependency (~100kB gzipped) — lazy
// loading these two chart components means the rest of the dashboard
// (holdings, search, trade panel) can render immediately instead of
// blocking on it, with the charts popping in shortly after in parallel.
const PriceChart = lazy(() => import('./PriceChart.jsx'));
const PerformanceChart = lazy(() => import('./PerformanceChart.jsx'));

const CHART_FALLBACK = <div className="chart-status">Loading chart…</div>;

export default function DashboardPage({
  state,
  holdingsValue,
  quotes,
  quoteError,
  selectedSymbol,
  selectedQuote,
  selectedHolding,
  onSelect,
  buy,
  sell,
  error,
  guest = false,
  onRequestLogin,
}) {
  const { orders, loading: ordersLoading, error: ordersError, place: placeOrder, cancel: cancelOrder } = useOrders();
  const { isWatching, add: watch, remove: unwatch } = useWatchlist();

  const watching = selectedQuote ? isWatching(selectedQuote.symbol) : false;

  return (
    <>
      {guest ? (
        <GuestGate
          title="Log in to start paper trading"
          description="Every account starts with $10,000 in virtual cash — track your portfolio, performance, and P&L."
          onRequestLogin={onRequestLogin}
        />
      ) : (
        <>
          <PortfolioSummary
            cash={state.cash}
            holdingsValue={holdingsValue}
            totalRealizedPnL={totalRealizedPnL(state.transactions)}
            startingCash={STARTING_CASH}
          />

          <section className="panel">
            <h2>Portfolio performance</h2>
            <Suspense fallback={CHART_FALLBACK}>
              <PerformanceChart />
            </Suspense>
          </section>

          <section className="panel">
            <h2>Portfolio breakdown</h2>
            <PortfolioBreakdown cash={state.cash} holdings={state.holdings} quotes={quotes} />
          </section>
        </>
      )}

      <section className="panel">
        <h2>Look up a stock or crypto</h2>
        <SearchBar onSelect={onSelect} />

        {quoteError && <div className="form-error">{quoteError}</div>}

        {selectedQuote && (
          <div className="quote-block">
            <div className="quote-heading">
              <h3>
                {selectedQuote.symbol} — {selectedQuote.name}
                {selectedQuote.type === 'CRYPTOCURRENCY' && <span className="search-badge crypto">Crypto</span>}
              </h3>
              <div className="quote-price">
                ${selectedQuote.price.toFixed(2)}{' '}
                <span className={selectedQuote.change >= 0 ? 'positive' : 'negative'}>
                  {selectedQuote.change >= 0 ? '+' : ''}
                  {selectedQuote.change?.toFixed(2)} ({selectedQuote.changePercent?.toFixed(2)}%)
                </span>
              </div>
              <div className="quote-meta">
                {selectedQuote.type === 'CRYPTOCURRENCY'
                  ? 'Trades 24/7 · always open'
                  : `${selectedQuote.exchange} · Market: ${selectedQuote.marketState}`}
              </div>
              {!guest && (
                <div className="quote-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      watching ? unwatch(selectedQuote.symbol) : watch(selectedQuote.symbol, selectedQuote.name)
                    }
                  >
                    <Icon name="star" size={14} filled={watching} /> {watching ? 'Watching' : 'Watch'}
                  </button>
                  <CreateAlertForm symbol={selectedQuote.symbol} name={selectedQuote.name} />
                </div>
              )}
            </div>

            <Suspense fallback={CHART_FALLBACK}>
              <PriceChart symbol={selectedSymbol} />
            </Suspense>

            {guest ? (
              <GuestGate
                compact
                title="Log in to trade"
                description="Watch symbols, set price alerts, and buy or sell with virtual cash."
                onRequestLogin={onRequestLogin}
              />
            ) : (
              <TradePanel
                quote={selectedQuote}
                holding={selectedHolding}
                cash={state.cash}
                onBuy={buy}
                onSell={sell}
                onPlaceOrder={placeOrder}
                error={error}
              />
            )}
          </div>
        )}

        {!selectedQuote && !quoteError && (
          <p className="empty-state">Search above and select a company or cryptocurrency to see its price and chart.</p>
        )}
      </section>

      {!guest && (
        <>
          <section className="panel">
            <h2>Your holdings</h2>
            <HoldingsTable holdings={state.holdings} quotes={quotes} onSelect={onSelect} />
          </section>

          <section className="panel">
            <h2>Open orders</h2>
            <OrdersPanel orders={orders} loading={ordersLoading} error={ordersError} onCancel={cancelOrder} />
          </section>

          <section className="panel">
            <h2>Transaction history</h2>
            <TransactionHistory transactions={state.transactions} />
          </section>
        </>
      )}
    </>
  );
}
