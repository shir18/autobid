/**
 * controllers/reviews.controller.js
 * Car reviews stored in MongoDB (or the file fallback store).
 */
'use strict';
const pool = require('../db');
const { reviews } = require('../services/store');
const { httpError } = require('../services/helpers');

/**
 * Reviews belong to the CAR (model), not to one variant listing: the list for any listing includes
 * the reviews written on every other listing/variant of the same car.
 */
async function list(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT c2.id FROM cars c
      JOIN variants v  ON v.id = c.variant_id
      JOIN variants v2 ON v2.model_id = v.model_id
      JOIN cars c2     ON c2.variant_id = v2.id
      WHERE c.id = ?`, [Number(req.params.carId)]);
    const ids = rows.length ? rows.map(r => r.id) : [req.params.carId];
    const lists = await Promise.all(ids.map(id => reviews.list(id)));
    res.json([].concat(...lists).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const carId = Number(req.params.carId);
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, 'Rating must be between 1 and 5');

    const [cars] = await pool.query('SELECT id FROM cars WHERE id = ?', [carId]);
    if (!cars.length) throw httpError(404, 'Car not found');
    const [users] = await pool.query('SELECT name FROM users WHERE id = ?', [req.user.id]);

    const asList = v => (Array.isArray(v) ? v : []).map(s => String(s).trim()).filter(Boolean).slice(0, 10);
    const doc = await reviews.create({
      car_id: carId,
      user_id: String(req.user.id),
      user_name: users[0] ? users[0].name : 'Anonymous',
      rating,
      title: String(req.body.title || '').slice(0, 120),
      body:  String(req.body.body  || '').slice(0, 2000),
      pros:  asList(req.body.pros),
      cons:  asList(req.body.cons)
    });
    res.status(201).json(doc);
  } catch (err) { next(err); }
}

module.exports = { list, create };
