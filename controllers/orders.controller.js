/**
 * controllers/orders.controller.js
 * Order management with GROUP BY status.
 * Everything is scoped to the logged-in user (buyer → own orders, dealer → own dealership's orders).
 */
'use strict';
const pool = require('../db');
const { httpError, getDealerByUser } = require('../services/helpers');
const { activity } = require('../services/store');

/** Builds a WHERE fragment for "orders visible to this user". */
async function scopeFor(user) {
  if (user.role === 'admin')  return { where: '1 = 1', params: [] };
  if (user.role === 'dealer') {
    const d = await getDealerByUser(user.id);
    if (!d) throw httpError(403, 'No dealership is linked to this account');
    return { where: 'o.dealer_id = ?', params: [d.id] };
  }
  return { where: 'o.buyer_id = ?', params: [user.id] };
}

async function listMine(req, res, next) {
  try {
    const scope = await scopeFor(req.user);
    const [rows] = await pool.query(`
      SELECT o.*, r.city, r.body_type, r.fuel, r.budget_min, r.budget_max,
             off.price AS offer_price, off.delivery_days, off.freebies,
             buyer.name AS buyer_name, buyer.email AS buyer_email,
             d.name AS dealer_name, d.city AS dealer_city
      FROM orders o
      JOIN requirements r ON r.id = o.requirement_id
      JOIN offers off     ON off.id = o.offer_id
      JOIN users buyer    ON buyer.id = o.buyer_id
      JOIN dealers d      ON d.id = o.dealer_id
      WHERE ${scope.where}
      ORDER BY o.created_at DESC, o.id DESC
    `, scope.params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowed = ['confirmed', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) throw httpError(400, `Invalid status '${status}'`);

    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!rows.length) throw httpError(404, 'Order not found');
    const order = rows[0];

    const dealer = req.user.role === 'dealer' ? await getDealerByUser(req.user.id) : null;
    const isDealerOwner = dealer && dealer.id === order.dealer_id;
    const isBuyerOwner  = order.buyer_id === req.user.id;

    if (req.user.role !== 'admin') {
      if (isDealerOwner) { /* dealer may deliver or cancel */ }
      else if (isBuyerOwner && status === 'cancelled') { /* buyer may cancel */ }
      else throw httpError(403, 'You are not allowed to change this order');
    }
    if (order.status !== 'confirmed') throw httpError(400, 'Only confirmed orders can be changed');
    if (status === 'confirmed') throw httpError(400, 'Order is already confirmed');

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, order.id]);

    // notify the other party
    const [d] = await pool.query('SELECT user_id FROM dealers WHERE id = ?', [order.dealer_id]);
    const notifyId = isDealerOwner ? order.buyer_id : (d[0] && d[0].user_id);
    if (notifyId) activity.record(notifyId, 'order_updated', order.id, { message: 'Order #' + order.id + ' is now ' + status });

    res.json({ message: 'Order status updated' });
  } catch (err) { next(err); }
}

// GROUP BY status for dashboard counts
async function countsByStatus(req, res, next) {
  try {
    const scope = await scopeFor(req.user);
    const [rows] = await pool.query(
      `SELECT o.status, COUNT(*) AS count FROM orders o WHERE ${scope.where} GROUP BY o.status`, scope.params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { listMine, updateStatus, countsByStatus };
