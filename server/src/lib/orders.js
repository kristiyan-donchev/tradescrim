import crypto from 'crypto';
import { pool } from '../db.js';
import { buyShares, sellShares } from './portfolio.js';

const ORDER_SELECT = `
  SELECT id, symbol, name, side, order_type AS "orderType", shares,
         limit_price AS "limitPrice", stop_price AS "stopPrice",
         stop_triggered AS "stopTriggered", status, created_at AS "createdAt",
         filled_at AS "filledAt", filled_price AS "filledPrice", cancel_reason AS "cancelReason"
  FROM orders WHERE user_id = $1 ORDER BY created_at DESC
`;

const ORDER_TYPES = ['LIMIT', 'STOP', 'STOP_LIMIT'];

export async function listOrders(userId) {
  const result = await pool.query(ORDER_SELECT, [userId]);
  return result.rows;
}

export async function placeOrder(userId, { symbol, name, side, orderType, shares, limitPrice, stopPrice }) {
  if (typeof symbol !== 'string' || !symbol.trim() || symbol.length > 20) {
    throw new Error('Enter a valid ticker symbol.');
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 200) {
    throw new Error('Enter a valid company name.');
  }
  if (side !== 'BUY' && side !== 'SELL') throw new Error('Side must be BUY or SELL.');
  if (!ORDER_TYPES.includes(orderType)) throw new Error('Unknown order type.');
  if (!(shares > 0) || !Number.isFinite(shares) || shares > 1e9) throw new Error('Enter a valid number of shares.');

  if (orderType === 'LIMIT' && !(limitPrice > 0 && Number.isFinite(limitPrice))) throw new Error('Enter a valid limit price.');
  if (orderType === 'STOP' && !(stopPrice > 0 && Number.isFinite(stopPrice))) throw new Error('Enter a valid stop price.');
  if (orderType === 'STOP_LIMIT' && !(limitPrice > 0 && Number.isFinite(limitPrice) && stopPrice > 0 && Number.isFinite(stopPrice))) {
    throw new Error('Enter both a stop price and a limit price.');
  }

  if (side === 'SELL') {
    const holdingResult = await pool.query(
      `SELECT shares FROM holdings WHERE user_id = $1 AND symbol = $2`,
      [userId, symbol]
    );
    const owned = holdingResult.rows[0]?.shares || 0;
    if (shares > owned + 1e-9) {
      throw new Error(`You only own ${owned} share(s) of ${symbol}. This simulator doesn't support short selling.`);
    }
  } else {
    const userResult = await pool.query(`SELECT cash FROM users WHERE id = $1`, [userId]);
    const cash = userResult.rows[0].cash;
    // Worst-case trigger price: a STOP order fills at whatever price crosses the
    // stop, a LIMIT/STOP_LIMIT order never fills worse than its limit price.
    const worstCasePrice = orderType === 'STOP' ? stopPrice : limitPrice;
    if (shares * worstCasePrice > cash + 1e-9) {
      throw new Error('Not enough virtual cash to cover this order if it fills at its trigger price.');
    }
  }

  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO orders (id, user_id, symbol, name, side, order_type, shares, limit_price, stop_price, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, userId, symbol, name, side, orderType, shares, limitPrice ?? null, stopPrice ?? null, Date.now()]
  );
  return listOrders(userId);
}

export async function cancelOrder(userId, orderId) {
  await pool.query(
    `UPDATE orders SET status = 'CANCELLED', cancel_reason = 'Cancelled by user'
     WHERE id = $1 AND user_id = $2 AND status = 'PENDING'`,
    [orderId, userId]
  );
  return listOrders(userId);
}

export async function getPendingOrderSymbols() {
  const result = await pool.query(`SELECT DISTINCT symbol FROM orders WHERE status = 'PENDING'`);
  return result.rows.map((r) => r.symbol);
}

function limitHit(side, price, limitPrice) {
  return side === 'BUY' ? price <= limitPrice : price >= limitPrice;
}

function stopHit(side, price, stopPrice) {
  return side === 'BUY' ? price >= stopPrice : price <= stopPrice;
}

// Evaluates every pending order against the given price map (symbol -> current
// price) and fills or advances (for stop-limit's stop leg) the ones whose
// trigger condition is met. Called from the scheduled market-check job in
// index.js with prices already fetched, so this does no network I/O itself.
// Fills reuse buyShares/sellShares — the same transactional cash/holdings/
// transaction-log logic a market order uses — so a filled limit/stop order is
// indistinguishable from a market trade once it lands in the portfolio.
export async function processOrders(priceMap) {
  const result = await pool.query(
    `SELECT id, user_id AS "userId", symbol, name, side, order_type AS "orderType", shares,
            limit_price AS "limitPrice", stop_price AS "stopPrice", stop_triggered AS "stopTriggered"
     FROM orders WHERE status = 'PENDING'`
  );

  for (const order of result.rows) {
    const price = priceMap[order.symbol];
    if (price == null) continue;

    let readyToFill = false;
    let fillPrice = price;

    if (order.orderType === 'LIMIT') {
      readyToFill = limitHit(order.side, price, order.limitPrice);
    } else if (order.orderType === 'STOP') {
      readyToFill = stopHit(order.side, price, order.stopPrice);
    } else {
      // STOP_LIMIT: the stop leg arms the order (still PENDING); once armed,
      // it behaves exactly like a LIMIT order.
      let triggered = order.stopTriggered;
      if (!triggered && stopHit(order.side, price, order.stopPrice)) {
        await pool.query(`UPDATE orders SET stop_triggered = TRUE WHERE id = $1`, [order.id]);
        triggered = true;
      }
      readyToFill = triggered && limitHit(order.side, price, order.limitPrice);
    }

    if (!readyToFill) continue;

    try {
      if (order.side === 'BUY') {
        await buyShares(order.userId, { symbol: order.symbol, name: order.name, shares: order.shares, price: fillPrice });
      } else {
        await sellShares(order.userId, { symbol: order.symbol, name: order.name, shares: order.shares, price: fillPrice });
      }
      await pool.query(
        `UPDATE orders SET status = 'FILLED', filled_at = $1, filled_price = $2 WHERE id = $3`,
        [Date.now(), fillPrice, order.id]
      );
    } catch (err) {
      await pool.query(
        `UPDATE orders SET status = 'CANCELLED', cancel_reason = $1 WHERE id = $2`,
        [err.message, order.id]
      );
    }
  }
}
