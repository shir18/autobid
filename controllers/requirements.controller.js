/**
 * controllers/requirements.controller.js
 * REVERSE BIDDING — buyer requirements.
 * Uses correlated subqueries for offer_count / lowest_offer / my_offer_price.
 */
'use strict';
const pool = require('../db');
const { httpError, getDealerByUser, positiveNumber } = require('../services/helpers');
const { activity } = require('../services/store');

async function list(req, res, next) {
  try {
    const { status, city } = req.query;
    let buyer_id = req.query.buyer_id;
    const conditions = [], params = [];

    // Buyers can only ever see their own requirements
    if (req.user.role === 'buyer') buyer_id = req.user.id;

    // Dealer context: "did I already bid?"
    let myDealerId = null;
    if (req.user.role === 'dealer') {
      const d = await getDealerByUser(req.user.id);
      myDealerId = d ? d.id : null;
    }

    if (status)   { conditions.push('r.status = ?');    params.push(status); }
    if (buyer_id) { conditions.push('r.buyer_id = ?');  params.push(buyer_id); }
    if (city)     { conditions.push('r.city = ?');      params.push(city); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(`
      SELECT r.*,
             u.name AS buyer_name,
             (SELECT COUNT(*)   FROM offers o WHERE o.requirement_id = r.id) AS offer_count,
             (SELECT MIN(price) FROM offers o WHERE o.requirement_id = r.id) AS lowest_offer,
             (SELECT o.price FROM offers o WHERE o.requirement_id = r.id AND o.dealer_id = ?) AS my_offer_price,
             (SELECT o.id    FROM offers o WHERE o.requirement_id = r.id AND o.dealer_id = ?) AS my_offer_id
      FROM requirements r
      JOIN users u ON u.id = r.buyer_id
      ${where}
      ORDER BY r.created_at DESC, r.id DESC
    `, [myDealerId, myDealerId, ...params]);
    res.json(rows);
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, u.name AS buyer_name,
             (SELECT COUNT(*) FROM offers o WHERE o.requirement_id = r.id) AS offer_count
      FROM requirements r
      JOIN users u ON u.id = r.buyer_id
      WHERE r.id = ?
    `, [req.params.id]);
    if (!rows.length) throw httpError(404, 'Requirement not found');
    if (req.user.role === 'buyer' && rows[0].buyer_id !== req.user.id) throw httpError(403, 'Not your requirement');
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { body_type, fuel, city } = req.body;
    const timeline_days = Math.max(1, Math.round(Number(req.body.timeline_days) || 30));
    const budget_min = Number(req.body.budget_min);
    const budget_max = Number(req.body.budget_max);
    if (!isFinite(budget_min) || budget_min < 0) throw httpError(400, 'Minimum budget must be a number');
    positiveNumber(budget_max, 'Maximum budget');
    if (budget_min > budget_max) throw httpError(400, 'Minimum budget cannot be higher than maximum budget');
    if (!String(city || '').trim()) throw httpError(400, 'City is required');

    const [result] = await pool.query(`
      INSERT INTO requirements (buyer_id, budget_min, budget_max, body_type, fuel, city, timeline_days)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [req.user.id, budget_min, budget_max, body_type || null, fuel || null, city, timeline_days]);
    res.status(201).json({ id: result.insertId, message: 'Requirement posted' });
  } catch (err) { next(err); }
}

/** PATCH /api/requirements/:id — buyer closes an open requirement (pending offers are rejected) */
async function close(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM requirements WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) throw httpError(404, 'Requirement not found');
    const r = rows[0];
    if (req.user.role !== 'admin' && r.buyer_id !== req.user.id) throw httpError(403, 'Not your requirement');
    if (r.status !== 'open') throw httpError(400, 'Only open requirements can be closed');

    const [pending] = await conn.query(
      `SELECT o.id, d.user_id FROM offers o JOIN dealers d ON d.id = o.dealer_id
       WHERE o.requirement_id = ? AND o.status = 'pending'`, [r.id]);
    await conn.query("UPDATE offers SET status = 'rejected' WHERE requirement_id = ? AND status = 'pending'", [r.id]);
    await conn.query("UPDATE requirements SET status = 'closed' WHERE id = ?", [r.id]);
    await conn.commit();

    pending.forEach(o => activity.record(o.user_id, 'offer_rejected', o.id, { message: 'Requirement #' + r.id + ' was closed by the buyer' }));
    res.json({ message: 'Requirement closed' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
}

module.exports = { list, get, create, close };
