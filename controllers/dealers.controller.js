/**
 * controllers/dealers.controller.js
 * Dealer listing/lookup + test-drive bookings (create, list, confirm/cancel).
 */
'use strict';
const pool = require('../db');
const { httpError, getDealerByUser, requireDealer, toDateOnly } = require('../services/helpers');
const { activity } = require('../services/store');

async function list(req, res, next) {
  try {
    const { city } = req.query;
    const params = [], conditions = [];
    if (city) { conditions.push('d.city = ?'); params.push(city); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const [rows] = await pool.query(`
      SELECT d.*, u.name AS contact_name, u.email AS contact_email
      FROM dealers d
      JOIN users u ON u.id = d.user_id
      ${where}
      ORDER BY d.name ASC
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT d.*, u.name AS contact_name, u.email AS contact_email
      FROM dealers d JOIN users u ON u.id = d.user_id
      WHERE d.id = ?
    `, [req.params.id]);
    if (!rows.length) throw httpError(404, 'Dealer not found');
    res.json(rows[0]);
  } catch (err) { next(err); }
}

/** GET /api/dealers/me — the dealership that belongs to the logged-in dealer */
async function me(req, res, next) {
  try {
    res.json(await requireDealer(req.user.id));
  } catch (err) { next(err); }
}

async function book(req, res, next) {
  try {
    const { car_id, notes } = req.body;
    const date = toDateOnly(req.body.scheduled_date);
    if (!date) throw httpError(400, 'Please choose a valid date for the test drive');
    if (date < new Date().toISOString().slice(0, 10)) throw httpError(400, 'Test drive date cannot be in the past');

    const [cars] = await pool.query('SELECT id, dealer_id FROM cars WHERE id = ?', [car_id]);
    if (!cars.length) throw httpError(404, 'Car not found');
    const dealerId = req.body.dealer_id || cars[0].dealer_id;
    if (!dealerId) throw httpError(400, 'This car has no dealer to book with');

    const [result] = await pool.query(`
      INSERT INTO bookings (car_id, user_id, dealer_id, scheduled_date, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [car_id, req.user.id, dealerId, date, notes || null]);

    // Tell the dealer's user about the new request
    const [d] = await pool.query('SELECT user_id FROM dealers WHERE id = ?', [dealerId]);
    if (d.length) activity.record(d[0].user_id, 'booking_requested', result.insertId, { message: 'New test-drive request for ' + date });

    res.status(201).json({ id: result.insertId, message: 'Test drive booked' });
  } catch (err) { next(err); }
}

const BOOKING_SELECT = `
  SELECT bk.id, bk.car_id, bk.user_id, bk.dealer_id, bk.scheduled_date, bk.status, bk.notes,
         m.name AS model_name, v.name AS variant_name, b.name AS brand_name,
         d.name AS dealer_name, d.city AS dealer_city,
         u.name AS buyer_name, u.email AS buyer_email
  FROM bookings bk
  JOIN cars c     ON c.id = bk.car_id
  JOIN variants v ON v.id = c.variant_id
  JOIN models m   ON m.id = v.model_id
  JOIN brands b   ON b.id = m.brand_id
  JOIN dealers d  ON d.id = bk.dealer_id
  JOIN users u    ON u.id = bk.user_id`;

async function listBookings(req, res, next) {
  try {
    if (String(req.params.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      throw httpError(403, 'You can only view your own bookings');
    }
    const [rows] = await pool.query(`${BOOKING_SELECT} WHERE bk.user_id = ? ORDER BY bk.scheduled_date ASC, bk.id ASC`, [req.params.userId]);
    res.json(rows);
  } catch (err) { next(err); }
}

/** GET /api/dealers/me/bookings — test drives requested at this dealership */
async function dealerBookings(req, res, next) {
  try {
    const dealer = await requireDealer(req.user.id);
    const [rows] = await pool.query(`${BOOKING_SELECT} WHERE bk.dealer_id = ? ORDER BY bk.scheduled_date ASC, bk.id ASC`, [dealer.id]);
    res.json(rows);
  } catch (err) { next(err); }
}

/** PATCH /api/dealers/bookings/:id { status } — dealer confirms/cancels, buyer may cancel */
async function updateBooking(req, res, next) {
  try {
    const { status } = req.body;
    if (!['confirmed', 'cancelled'].includes(status)) throw httpError(400, "status must be 'confirmed' or 'cancelled'");
    const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!rows.length) throw httpError(404, 'Booking not found');
    const booking = rows[0];

    const dealer = req.user.role === 'dealer' ? await getDealerByUser(req.user.id) : null;
    const isDealerOwner = dealer && dealer.id === booking.dealer_id;
    const isBuyerOwner  = booking.user_id === req.user.id;
    if (req.user.role !== 'admin') {
      if (!isDealerOwner && !(isBuyerOwner && status === 'cancelled')) throw httpError(403, 'Not allowed');
    }
    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', [status, booking.id]);

    if (isDealerOwner || req.user.role === 'admin') {
      activity.record(booking.user_id, status === 'confirmed' ? 'booking_confirmed' : 'booking_cancelled', booking.id,
        { message: 'Your test drive on ' + toDateOnly(booking.scheduled_date) + ' was ' + status });
    }
    res.json({ message: 'Booking ' + status });
  } catch (err) { next(err); }
}

module.exports = { list, get, me, book, listBookings, dealerBookings, updateBooking };
