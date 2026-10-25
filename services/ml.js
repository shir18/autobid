/**
 * services/ml.js — runs the trained ML models inside Node (no Python needed at runtime).
 *
 * The models are trained by `python ml/train.py` (scikit-learn GradientBoostingRegressor) and
 * exported as JSON trees in ml/models/. This file re-implements the tiny prediction step:
 *     prediction = init + learning_rate × Σ tree(x)
 * Feature encoders below MUST stay in sync with encode_used() / encode_bid() in ml/train.py.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const MODEL_DIR = path.join(__dirname, '..', 'ml', 'models');
const cache = {};

function load(name) {
  if (cache[name] !== undefined) return cache[name];
  try { cache[name] = JSON.parse(fs.readFileSync(path.join(MODEL_DIR, name + '.json'), 'utf8')); }
  catch (e) { cache[name] = null; }   // model file missing → callers fall back to heuristics
  return cache[name];
}

function walk(tree, x) {
  let n = 0;
  while (tree.left[n] !== -1) n = x[tree.feature[n]] <= tree.threshold[n] ? tree.left[n] : tree.right[n];
  return tree.value[n];
}
function gbrPredict(model, x) {
  let s = model.init;
  for (const t of model.trees) s += model.learning_rate * walk(t, x);
  return s;
}

const oneHot = (list, v) => list.map(k => (k === v ? 1 : 0));

// ── used-car price model ────────────────────────────────────────────────────────────────
function encodeUsed(m, c) {
  const age = Math.max(0, m.current_year - Number(c.year));
  const km  = Number(c.km_driven) || 0;
  return [
    Math.log(Number(c.ex_showroom_price)), age, km / 10000, Number(c.owner_count) || 1, km / 10000 / Math.max(1, age),
    ...oneHot(m.brands, c.brand_name), ...oneHot(m.bodies, c.body_type), ...oneHot(m.fuels, c.fuel_type),
    c.transmission === 'Automatic' ? 1 : 0
  ];
}

/**
 * Predicts the fair market price of a used car.
 * @param c {brand_name, body_type, fuel_type, transmission, year, km_driven, owner_count, ex_showroom_price}
 * @returns {price, low, high} in ₹ (low/high = ~80 % prediction interval) or null if the model is missing
 */
function predictUsedPrice(c) {
  const m = load('used_price');
  if (!m || !c || !Number(c.ex_showroom_price)) return null;
  const z = gbrPredict(m, encodeUsed(m, c));
  const band = 1.28 * (m.residual_std || 0.05);
  const r = v => Math.round(Math.exp(v) / 1000) * 1000;
  return { price: r(z), low: r(z - band), high: r(z + band) };
}

// ── reverse-bidding: winning-bid model ──────────────────────────────────────────────────
function encodeBid(m, r, nOffers) {
  const bmax = Number(r.budget_max), bmin = Number(r.budget_min), mid = (bmax + bmin) / 2;
  const body = m.bodies.includes(r.body_type) ? r.body_type : 'Any';
  const fuel = m.fuels.includes(r.fuel) ? r.fuel : 'Any';
  return [
    Math.log(Math.max(1, bmax)), Math.log(Math.max(1, mid)), (bmax - bmin) / Math.max(1, bmax),
    Number(r.timeline_days) || 30, nOffers, m.city_tier[r.city] || 2,
    ...oneHot(m.bodies, body), ...oneHot(m.fuels, fuel)
  ];
}

/**
 * Suggests a competitive offer price for a buyer requirement.
 * @returns {ratio, price, low, high} or null when the model file is missing
 */
function suggestBid(requirement, nOffers) {
  const m = load('bid_price');
  if (!m) return null;
  const ratio = Math.min(0.99, Math.max(0.5, gbrPredict(m, encodeBid(m, requirement, nOffers || 0))));
  const sd = m.residual_std || 0.02;
  const bmax = Number(requirement.budget_max);
  const r = v => Math.round(v * bmax / 1000) * 1000;
  return { ratio, price: r(ratio), low: r(ratio - sd), high: r(ratio + sd) };
}

function info() {
  try { return JSON.parse(fs.readFileSync(path.join(MODEL_DIR, 'metrics.json'), 'utf8')); }
  catch (e) { return {}; }
}

module.exports = { predictUsedPrice, suggestBid, info, _gbrPredict: gbrPredict, _load: load, _encodeUsed: encodeUsed, _encodeBid: encodeBid };
