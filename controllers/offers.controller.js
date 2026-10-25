/**
 * controllers/offers.controller.js
 * REVERSE BIDDING — dealer offers on requirements.
 *
 * ATOMIC TRANSACTION: acceptOffer wraps the entire accept-and-reject flow
 * in a single database transaction. If any step fails, everything is rolled back.
 */
'use strict';
const pool = require('../db');
const { httpError, requireDealer, getDealerByUser, positiveNumber } = require('../services/helpers');
const { activity } = require('../services/store');

const inr = n => '₹' + Number(n).toLocaleString('en-IN');

async function listByRequirement(req, res, next) {
  try {
    const { requirementId } = req.params;
    const { sort = 'price' } = req.query;
    const sortMap = {
      price:    'o.price ASC, o.id ASC',
      delivery: 'o.delivery_days ASC, o.id ASC',
      newest:   'o.created_at DESC, o.id DESC'
    };
    const orderBy = sortMap[sort] || sortMap.price;

    const [reqRows] = await pool.query('SELECT id, buyer_id FROM requirements WHERE id = ?', [requirementId]);
    if (!reqRows.length) throw httpError(404, 'Requirement not found');
    if (req.user.role !== 'admin' && reqRows[0].buyer_id !== req.user.id) throw httpError(403, 'Only the buyer can see all offers');

    const [rows] = await pool.query(`
      SELECT o.*, d.name AS dealer_name, d.city AS dealer_city, d.verified, d.user_id AS dealer_user_id
      FROM offers o
      JOIN dealers d ON d.id = o.dealer_id
      WHERE o.requirement_id = ?
      ORDER BY ${orderBy}
    `, [requirementId]);
    res.json(rows);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const dealer = await requireDealer(req.user.id);
    const { requirement_id, freebies } = req.body;
    const price = positiveNumber(req.body.price, 'Price');
    const delivery_days = Math.round(positiveNumber(req.body.delivery_days, 'Delivery days'));

    const [reqRows] = await pool.query("SELECT id, buyer_id, status FROM requirements WHERE id = ?", [requirement_id]);
    if (!reqRows.length) throw httpError(404, 'Requirement not found');
    if (reqRows[0].status !== 'open') throw httpError(400, 'Requirement is not open');

    const [dup] = await pool.query('SELECT id FROM offers WHERE requirement_id = ? AND dealer_id = ?', [requirement_id, dealer.id]);
    if (dup.length) throw httpError(409, 'You already placed an offer — edit it to lower your bid');

    const [result] = await pool.query(`
      INSERT INTO offers (requirement_id, dealer_id, price, delivery_days, freebies)
      VALUES (?, ?, ?, ?, ?)
    `, [requirement_id, dealer.id, price, delivery_days, freebies || null]);

    activity.record(reqRows[0].buyer_id, 'new_offer', result.insertId,
      { message: dealer.name + ' offered ' + inr(price) + ' on requirement #' + requirement_id });
    res.status(201).json({ id: result.insertId, message: 'Offer submitted' });
  } catch (err) { next(err); }
}

/** PATCH /api/offers/:id — dealer revises a pending offer (reverse bidding = bid it down) */
async function update(req, res, next) {
  try {
    const dealer = await requireDealer(req.user.id);
    const [rows] = await pool.query(`
      SELECT o.*, r.buyer_id, r.status AS req_status FROM offers o
      JOIN requirements r ON r.id = o.requirement_id WHERE o.id = ?`, [req.params.id]);
    if (!rows.length) throw httpError(404, 'Offer not found');
    const offer = rows[0];
    if (offer.dealer_id !== dealer.id) throw httpError(403, 'Not your offer');
    if (offer.status !== 'pending' || offer.req_status !== 'open') throw httpError(400, 'Only pending offers on open requirements can be edited');

    const price = req.body.price !== undefined ? positiveNumber(req.body.price, 'Price') : offer.price;
    const days  = req.body.delivery_days !== undefined ? Math.round(positiveNumber(req.body.delivery_days, 'Delivery days')) : offer.delivery_days;
    const freebies = req.body.freebies !== undefined ? (req.body.freebies || null) : offer.freebies;

    await pool.query('UPDATE offers SET price = ?, delivery_days = ?, freebies = ? WHERE id = ?', [price, days, freebies, offer.id]);
    activity.record(offer.buyer_id, 'new_offer', offer.id, { message: dealer.name + ' revised their offer to ' + inr(price) });
    res.json({ message: 'Offer updated' });
  } catch (err) { next(err); }
}

/**
 * ATOMIC TRANSACTION — The crown jewel of reverse bidding.
 * Steps (all in one transaction):
 * 1. Mark chosen offer as 'accepted'
 * 2. Mark all other offers for this requirement as 'rejected'
 * 3. Mark the requirement as 'awarded'
 * 4. Create an order record
 * If any step throws, ROLLBACK is called and nothing is committed.
 */
async function acceptOffer(req, res, next) {
  const conn = await pool.getConnection();
  let notify = [];
  try {
    await conn.beginTransaction();
    const offerId = Number(req.params.id);

    const [offerRows] = await conn.query("SELECT * FROM offers WHERE id = ? AND status = 'pending' FOR UPDATE", [offerId]);
    if (!offerRows.length) throw httpError(404, 'Offer not found or already processed');
    const offer = offerRows[0];

    const [reqRows] = await conn.query("SELECT * FROM requirements WHERE id = ? AND status = 'open' FOR UPDATE", [offer.requirement_id]);
    if (!reqRows.length) throw httpError(400, 'Requirement is not open');
    const requirement = reqRows[0];

    // Only the buyer who posted the requirement (or an admin) may accept
    if (req.user.role !== 'admin' && requirement.buyer_id !== req.user.id) throw httpError(403, 'Only the buyer who posted this requirement can accept offers');

    // who to notify (collected inside the transaction, sent after commit)
    const [winner] = await conn.query('SELECT user_id FROM dealers WHERE id = ?', [offer.dealer_id]);
    const [losers] = await conn.query(
      `SELECT o.id, d.user_id FROM offers o JOIN dealers d ON d.id = o.dealer_id
       WHERE o.requirement_id = ? AND o.id != ? AND o.status = 'pending'`, [requirement.id, offerId]);

    await conn.query("UPDATE offers SET status = 'accepted' WHERE id = ?", [offerId]);                                             // 1
    await conn.query("UPDATE offers SET status = 'rejected' WHERE requirement_id = ? AND id != ? AND status = 'pending'",
                     [requirement.id, offerId]);                                                                                   // 2
    await conn.query("UPDATE requirements SET status = 'awarded' WHERE id = ?", [requirement.id]);                                // 3
    const [orderResult] = await conn.query(
      'INSERT INTO orders (requirement_id, offer_id, buyer_id, dealer_id) VALUES (?, ?, ?, ?)',
      [requirement.id, offerId, requirement.buyer_id, offer.dealer_id]);                                                          // 4

    await conn.commit();

    if (winner.length) activity.record(winner[0].user_id, 'offer_accepted', offerId, { message: 'Your ' + inr(offer.price) + ' offer on requirement #' + requirement.id + ' was accepted!' });
    losers.forEach(l => activity.record(l.user_id, 'offer_rejected', l.id, { message: 'Requirement #' + requirement.id + ' was awarded to another dealer' }));

    res.json({ message: 'Offer accepted and order created', orderId: orderResult.insertId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

async function listByDealer(req, res, next) {
  try {
    const dealer = req.user.role === 'admin' ? { id: Number(req.params.dealerId) } : await requireDealer(req.user.id);
    const [rows] = await pool.query(`
      SELECT o.*, r.city AS req_city, r.body_type, r.fuel, r.budget_min, r.budget_max, r.status AS req_status,
             u.name AS buyer_name,
             (SELECT MIN(o2.price) FROM offers o2 WHERE o2.requirement_id = o.requirement_id) AS lowest_offer
      FROM offers o
      JOIN requirements r ON r.id = o.requirement_id
      JOIN users u ON u.id = r.buyer_id
      WHERE o.dealer_id = ?
      ORDER BY o.created_at DESC, o.id DESC
    `, [dealer.id]);
    res.json(rows);
  } catch (err) { next(err); }
}

// GROUP BY status (Ex 7 concept)
async function countsByStatus(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT status, COUNT(*) AS count FROM offers GROUP BY status');
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { listByRequirement, create, update, acceptOffer, listByDealer, countsByStatus };
