/**
 * controllers/ml.controller.js — endpoints backed by the ML models.
 *   GET  /api/ml/info                     model metrics (what was trained, on what, how well)
 *   POST /api/ml/recommend                Smart Match quiz → KNN recommender (one result per car)
 *   GET  /api/ml/similar/:carId           cars similar to this one (item-to-item nearest neighbours)
 *   GET  /api/ml/used-price               fair-price estimate for a used car being listed (dealers)
 *   GET  /api/ml/bid-suggestion/:reqId    suggested competitive offer for a buyer requirement (dealers)
 */
'use strict';
const pool = require('../db');
const ml   = require('../services/ml');
const recommender = require('../services/recommender');
const { httpError } = require('../services/helpers');
const { groupByModel } = require('./cars.controller');

const LISTING_SELECT = `
  SELECT c.id, c.type, c.year, c.city, c.listing_price, c.image_url, c.dealer_id,
         v.id AS variant_id, v.name AS variant_name, v.transmission, v.mileage_kmpl, v.engine_cc, v.fuel_type,
         v.power_bhp, v.boot_space_l, v.ncap_stars, v.range_km, v.airbags,
         m.id AS model_id, m.name AS model_name, m.body_type, m.seating,
         b.name AS brand_name, b.slug AS brand_slug
  FROM cars c JOIN variants v ON v.id = c.variant_id JOIN models m ON m.id = v.model_id JOIN brands b ON b.id = m.brand_id
  WHERE c.type = 'new' AND c.status = 'available'`;

async function info(req, res, next) {
  try { res.json(ml.info()); } catch (err) { next(err); }
}

async function recommend(req, res, next) {
  try {
    const a = req.body || {};
    if (!a.budget || !a.usage || !a.family || !a.fuel) throw httpError(400, 'budget, usage, family and fuel are required');
    const [rows] = await pool.query(LISTING_SELECT);
    const results = recommender.recommend(rows, a, Math.min(12, Number(req.query.limit) || 6));
    res.json(results);
  } catch (err) { next(err); }
}

async function similar(req, res, next) {
  try {
    const [t] = await pool.query(`${LISTING_SELECT.replace("WHERE c.type = 'new' AND c.status = 'available'", 'WHERE c.id = ?')}`, [req.params.carId]);
    if (!t.length) throw httpError(404, 'Car not found');
    const [rows] = await pool.query(LISTING_SELECT);
    res.json(recommender.similar(t[0], rows, Math.min(8, Number(req.query.k) || 4)));
  } catch (err) { next(err); }
}

async function usedPrice(req, res, next) {
  try {
    const { variant_id, year, km_driven = 0, owner_count = 1 } = req.query;
    if (!variant_id || !year) throw httpError(400, 'variant_id and year are required');
    const [rows] = await pool.query(`
      SELECT v.price AS ex_showroom_price, v.transmission, v.fuel_type, m.body_type, b.name AS brand_name
      FROM variants v JOIN models m ON m.id = v.model_id JOIN brands b ON b.id = m.brand_id WHERE v.id = ?`, [variant_id]);
    if (!rows.length) throw httpError(404, 'Variant not found');
    const pred = ml.predictUsedPrice({ ...rows[0], year: Number(year), km_driven: Number(km_driven), owner_count: Number(owner_count) });
    if (!pred) throw httpError(503, 'Price model not available — run: python ml/train.py');
    res.json({ ...pred, basis: 'ML price model (gradient boosting)' });
  } catch (err) { next(err); }
}

async function bidSuggestion(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, (SELECT COUNT(*) FROM offers o WHERE o.requirement_id = r.id) AS offer_count,
                  (SELECT MIN(price) FROM offers o WHERE o.requirement_id = r.id) AS lowest_offer
      FROM requirements r WHERE r.id = ?`, [req.params.reqId]);
    if (!rows.length) throw httpError(404, 'Requirement not found');
    const r = rows[0];
    const s = ml.suggestBid(r, Number(r.offer_count));
    if (!s) throw httpError(503, 'Bid model not available — run: python ml/train.py');
    const lowest = r.lowest_offer == null ? null : Number(r.lowest_offer);
    res.json({
      requirement_id: r.id, suggested_price: s.price, range_low: s.low, range_high: s.high,
      competing_offers: Number(r.offer_count), lowest_offer: lowest,
      beat_lowest_price: lowest ? Math.round((lowest * 0.99) / 1000) * 1000 : null,
      basis: 'ML bid model (gradient boosting) — typical winning bid for similar requirements'
    });
  } catch (err) { next(err); }
}

module.exports = { info, recommend, similar, usedPrice, bidSuggestion };
