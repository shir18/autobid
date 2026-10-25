/**
 * controllers/cars.controller.js
 * Car listings — new and used. Demonstrates:
 * - Query string filtering: brand, fuel, minPrice, maxPrice, sort, page, limit, type, city, bodyType …
 * - Parameterized queries only
 * - Fair-price meter (median of comparable listings, computed in SQL data + JS)
 */
'use strict';
const pool = require('../db');
const { httpError, getDealerByUser, positiveNumber } = require('../services/helpers');
const ml = require('../services/ml');

const PAGE_SIZE = 12;
const MAX_LIMIT = 500;

const SPEC_COLUMNS = `
  v.fuel_type, v.power_bhp, v.torque_nm, v.boot_space_l, v.airbags, v.ncap_stars,
  v.ground_clearance_mm, v.kerb_weight_kg, v.battery_kwh, v.range_km, v.features`;
const CAR_COLUMNS = `
  c.id, c.type, c.year, c.km_driven, c.owner_count, c.city,
  c.listing_price, c.status, c.image_url, c.dealer_id, c.created_at,
  v.id AS variant_id, v.name AS variant_name, v.transmission,
  v.mileage_kmpl, v.engine_cc, v.price AS ex_showroom_price,
  m.id AS model_id, m.name AS model_name, m.body_type, m.fuel_type AS model_fuel_types, m.seating,
  b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug,
  ${SPEC_COLUMNS}`;
const CAR_JOINS = `
  FROM cars c
  JOIN variants v ON v.id = c.variant_id
  JOIN models m   ON m.id = v.model_id
  JOIN brands b   ON b.id = m.brand_id`;

const FUEL_ORDER = ['Petrol', 'Diesel', 'CNG', 'Hybrid', 'Electric'];

/** Parses the JSON feature list stored on a variant (MySQL may hand back an object already). */
function parseFeatures(v) {
  if (Array.isArray(v)) return v;
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

/**
 * Collapses listing rows (one per variant) into one row per car/model.
 * The row's `id` is the cheapest variant's listing so links and compare keep working.
 */
function groupByModel(rows) {
  const map = new Map();
  for (const r of rows) {
    let g = map.get(r.model_id);
    if (!g) {
      g = { ...r, variant_count: 0, fuels: new Set(), trans: new Set(), min_price: Infinity, max_price: 0,
            best_mileage: 0, top_power: 0, newest_id: 0, variant_names: [] };
      map.set(r.model_id, g);
    }
    const price = Number(r.listing_price);
    g.variant_count++;
    g.fuels.add(r.fuel_type); g.trans.add(r.transmission);
    g.variant_names.push(r.variant_name);
    g.max_price = Math.max(g.max_price, price);
    g.best_mileage = Math.max(g.best_mileage, Number(r.mileage_kmpl) || 0);
    g.top_power = Math.max(g.top_power, Number(r.power_bhp) || 0);
    g.newest_id = Math.max(g.newest_id, Number(r.id));
    if (price < g.min_price) {                       // cheapest variant represents the car
      g.min_price = price;
      Object.assign(g, r);
    }
  }
  return [...map.values()].map(g => {
    const fuels = FUEL_ORDER.filter(f => g.fuels.has(f));
    const out = { ...g, listing_price: g.min_price, fuel_types: fuels, fuel_type: fuels.join(','),
                  transmissions: [...g.trans] };
    delete out.fuels; delete out.trans;
    out.features = parseFeatures(out.features);
    return out;
  });
}

async function list(req, res, next) {
  try {
    const {
      brand, fuel, minPrice, maxPrice, sort = 'price_asc', page = 1, limit,
      type, city, bodyType, transmission, seats, year, maxKm, owner, dealer_id, status, q, group
    } = req.query;

    const params = [];
    const conditions = [];

    // Only available cars are public, unless a dealer/admin asks for a specific status or their own stock
    if (status)         { conditions.push('c.status = ?');            params.push(status); }
    else if (!dealer_id){ conditions.push("c.status = 'available'"); }
    if (dealer_id)   { conditions.push('c.dealer_id = ?');           params.push(Number(dealer_id)); }
    if (type)        { conditions.push('c.type = ?');                params.push(type); }
    if (city)        { conditions.push('c.city = ?');                params.push(city); }
    if (brand)       { conditions.push('b.slug = ?');                params.push(brand); }
    if (fuel)        { conditions.push('v.fuel_type = ?');           params.push(fuel); }
    if (bodyType)    { conditions.push('m.body_type = ?');           params.push(bodyType); }
    if (transmission){ conditions.push('v.transmission = ?');        params.push(transmission); }
    if (seats)       { conditions.push('m.seating >= ?');            params.push(Number(seats)); }
    if (minPrice)    { conditions.push('c.listing_price >= ?');      params.push(Number(minPrice)); }
    if (maxPrice)    { conditions.push('c.listing_price <= ?');      params.push(Number(maxPrice)); }
    if (year)        { conditions.push('c.year = ?');                params.push(Number(year)); }
    if (maxKm)       { conditions.push('c.km_driven <= ?');          params.push(Number(maxKm)); }
    if (owner)       { conditions.push('c.owner_count <= ?');        params.push(Number(owner)); }
    if (q)           { conditions.push('(m.name LIKE ? OR b.name LIKE ? OR v.name LIKE ?)'); const like = '%' + q + '%'; params.push(like, like, like); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const sortMap = {
      price_asc:    'c.listing_price ASC, c.id ASC',
      price_desc:   'c.listing_price DESC, c.id ASC',
      mileage_desc: 'v.mileage_kmpl DESC, c.id ASC',
      newest:       'c.created_at DESC, c.id DESC'
    };
    const orderBy  = sortMap[sort] || sortMap.price_asc;
    const pageSize = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || PAGE_SIZE));
    const pageNo   = Math.max(1, Number(page) || 1);
    const offset   = (pageNo - 1) * pageSize;

    // group=model → ONE entry per car (model); its variants are chosen on the car page.
    if (group === 'model') {
      const [all] = await pool.query(`SELECT ${CAR_COLUMNS} ${CAR_JOINS} ${where}`, params);
      const groups = groupByModel(all);
      const cmp = {
        price_asc:    (a, b) => a.min_price - b.min_price || a.model_id - b.model_id,
        price_desc:   (a, b) => b.min_price - a.min_price || a.model_id - b.model_id,
        mileage_desc: (a, b) => (b.best_mileage || 0) - (a.best_mileage || 0) || a.model_id - b.model_id,
        newest:       (a, b) => b.newest_id - a.newest_id
      }[sort] || ((a, b) => a.min_price - b.min_price);
      groups.sort(cmp);
      const ps = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || PAGE_SIZE));
      const pn = Math.max(1, Number(page) || 1);
      return res.json({ data: groups.slice((pn - 1) * ps, pn * ps), page: pn, pageSize: ps, total: groups.length, grouped: true });
    }

    const [rows] = await pool.query(
      `SELECT ${CAR_COLUMNS} ${CAR_JOINS} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total ${CAR_JOINS} ${where}`, params);

    res.json({ data: rows, page: pageNo, pageSize, total: Number(countRows[0].total) });
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, v.name AS variant_name, v.transmission, v.mileage_kmpl,
             v.engine_cc, v.price AS ex_showroom_price, v.color_options, ${SPEC_COLUMNS},
             m.id AS model_id, m.name AS model_name, m.body_type, m.fuel_type AS model_fuel_types, m.seating,
             b.name AS brand_name, b.slug AS brand_slug,
             d.name AS dealer_name, d.city AS dealer_city, d.address AS dealer_address,
             d.user_id AS dealer_user_id
      FROM cars c
      JOIN variants v ON v.id = c.variant_id
      JOIN models m   ON m.id = v.model_id
      JOIN brands b   ON b.id = m.brand_id
      LEFT JOIN dealers d ON d.id = c.dealer_id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!rows.length) throw httpError(404, 'Car not found');
    const car = rows[0];
    if (typeof car.color_options === 'string') {
      try { car.color_options = JSON.parse(car.color_options); } catch (e) { car.color_options = []; }
    }

    car.features = parseFeatures(car.features);

    // Every variant of this car with its OWN specs, plus the cheapest available new listing of that
    // variant — the car page swaps specs, price, dealer and listing when the buyer picks a variant.
    const [vrows] = await pool.query(`
      SELECT v.id, v.model_id, v.name, v.price, v.transmission, v.mileage_kmpl, v.engine_cc, ${SPEC_COLUMNS},
             c.id AS listing_id, c.listing_price, c.city AS listing_city, c.image_url AS listing_image, c.dealer_id AS listing_dealer_id,
             d.name AS listing_dealer_name, d.address AS listing_dealer_address, d.city AS listing_dealer_city,
             d.user_id AS listing_dealer_user_id
      FROM variants v
      LEFT JOIN cars c    ON c.variant_id = v.id AND c.type = 'new' AND c.status = 'available'
      LEFT JOIN dealers d ON d.id = c.dealer_id
      WHERE v.model_id = ?
      ORDER BY v.price ASC, c.listing_price ASC, c.id ASC
    `, [car.model_id]);
    const seen = new Set(), variants = [];
    for (const r of vrows) {
      if (seen.has(r.id)) continue;                 // keep the cheapest listing of each variant
      seen.add(r.id);
      const { listing_id, listing_price, listing_city, listing_image, listing_dealer_id, listing_dealer_name,
              listing_dealer_address, listing_dealer_city, listing_dealer_user_id, ...v } = r;
      v.features = parseFeatures(v.features);
      v.listing = listing_id ? {
        id: listing_id, listing_price: Number(listing_price), city: listing_city, image_url: listing_image,
        dealer_id: listing_dealer_id, dealer_name: listing_dealer_name, dealer_address: listing_dealer_address,
        dealer_city: listing_dealer_city, dealer_user_id: listing_dealer_user_id
      } : null;
      variants.push(v);
    }
    res.json({ ...car, variants });
  } catch (err) { next(err); }
}

/** All variants with model/brand names — used by the dealer "add listing" form. */
async function variants(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT v.id, v.name, v.price, v.transmission, v.fuel_type, m.name AS model_name, b.name AS brand_name
      FROM variants v JOIN models m ON m.id = v.model_id JOIN brands b ON b.id = m.brand_id
      ORDER BY b.name, m.name, v.price
    `);
    res.json(rows);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { variant_id, type = 'new', year, km_driven = 0, owner_count = 0, city, image_url } = req.body;
    let { dealer_id } = req.body;
    const price = positiveNumber(req.body.listing_price, 'Price');

    if (req.user.role === 'dealer') {
      const d = await getDealerByUser(req.user.id);
      if (!d) throw httpError(403, 'No dealership is linked to this account');
      dealer_id = d.id;
    }
    if (!['new', 'used'].includes(type)) throw httpError(400, 'type must be new or used');

    const [result] = await pool.query(`
      INSERT INTO cars (variant_id, type, year, km_driven, owner_count, city, listing_price, dealer_id, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [variant_id, type, Number(year), Number(km_driven) || 0, Number(owner_count) || 0, city, price, dealer_id || null, image_url || null]);

    res.status(201).json({ id: result.insertId, message: 'Car listing created' });
  } catch (err) { next(err); }
}

/** Dealers can only touch their own stock; admins can touch anything. */
async function assertCanModify(req, carId) {
  const [rows] = await pool.query('SELECT id, dealer_id FROM cars WHERE id = ?', [carId]);
  if (!rows.length) throw httpError(404, 'Car not found');
  if (req.user.role === 'admin') return rows[0];
  const d = await getDealerByUser(req.user.id);
  if (!d || d.id !== rows[0].dealer_id) throw httpError(403, 'You can only modify your own listings');
  return rows[0];
}

async function update(req, res, next) {
  try {
    await assertCanModify(req, req.params.id);
    const { listing_price, status, city } = req.body;
    const updates = [], params = [];
    if (listing_price !== undefined) { updates.push('listing_price = ?'); params.push(positiveNumber(listing_price, 'Price')); }
    if (status !== undefined) {
      if (!['available', 'sold', 'reserved'].includes(status)) throw httpError(400, 'Invalid status');
      updates.push('status = ?'); params.push(status);
    }
    if (city !== undefined)          { updates.push('city = ?');          params.push(city); }
    if (!updates.length) throw httpError(400, 'No fields to update');
    params.push(req.params.id);
    await pool.query(`UPDATE cars SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Updated' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await assertCanModify(req, req.params.id);
    await pool.query('DELETE FROM cars WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}

// Compare: fetch multiple cars by IDs (returned in the order requested)
async function compare(req, res, next) {
  try {
    const ids = (req.query.ids || '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 4);
    if (!ids.length) return res.json([]);
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT ${CAR_COLUMNS} ${CAR_JOINS} WHERE c.id IN (${placeholders})`, ids
    );
    rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Fair price meter ─────────────────────────────────────────────────────────
function median(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * GET /api/cars/:id/fair-price
 *  • used cars → ML price model (gradient boosting trained on age, km, owners, brand, body, fuel,
 *                transmission and ex-showroom price) predicts the fair market value. If the model
 *                file is missing, falls back to the median of comparable listings / depreciation.
 *  • new cars  → median of the other listings of the same variant + the ex-showroom price.
 * Label: < 95 % of market = "Great deal", 95–105 % = "Fair", > 105 % = "Above market".
 */
async function fairPrice(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.type, c.year, c.km_driven, c.owner_count, c.listing_price, c.variant_id,
             v.price AS ex_showroom_price, v.model_id, v.transmission, v.fuel_type,
             m.body_type, b.name AS brand_name
      FROM cars c JOIN variants v ON v.id = c.variant_id
                  JOIN models m ON m.id = v.model_id JOIN brands b ON b.id = m.brand_id
      WHERE c.id = ?
    `, [req.params.id]);
    if (!rows.length) throw httpError(404, 'Car not found');
    const car = rows[0];
    const own = Number(car.listing_price);

    let prices = [], basis = '', market = null, method = 'median', low = null, high = null;
    if (car.type === 'used') {
      const [cmp] = await pool.query(`
        SELECT c.listing_price FROM cars c JOIN variants v ON v.id = c.variant_id
        WHERE v.model_id = ? AND c.type = 'used' AND c.status = 'available'
          AND c.id != ? AND c.year BETWEEN ? AND ?
      `, [car.model_id, car.id, car.year - 2, car.year + 2]);
      prices = cmp.map(r => Number(r.listing_price));

      const pred = ml.predictUsedPrice(car);
      if (pred) {
        market = pred.price; low = pred.low; high = pred.high;
        basis = 'ML price model (gradient boosting)'; method = 'ml';
        prices = [pred.price];
      } else {
        basis = 'similar used cars';
        if (prices.length < 3) {
          const age = Math.max(0, new Date().getFullYear() - car.year);
          let value = Number(car.ex_showroom_price) * Math.max(0.35, 1 - 0.15 - 0.09 * Math.max(0, age - 1));
          const expectedKm = Math.max(1, age) * 10000;
          value *= 1 - Math.max(-0.05, Math.min(0.15, ((car.km_driven - expectedKm) / 100000) * 0.1));
          prices = [Math.round(value)];
          basis = 'age & mileage depreciation model';
        }
      }
    } else {
      const [cmp] = await pool.query(`
        SELECT listing_price FROM cars WHERE variant_id = ? AND type = 'new' AND status = 'available' AND id != ?
      `, [car.variant_id, car.id]);
      prices = cmp.map(r => Number(r.listing_price));
      prices.push(Number(car.ex_showroom_price));
      basis = 'ex-showroom & other dealer prices';
    }

    if (market === null) market = median(prices);
    const ratio  = market > 0 ? own / market : 1;
    let label, detail;
    if (ratio < 0.95)       { label = 'Great deal';   detail = ((1 - ratio) * 100).toFixed(1) + '% below market'; }
    else if (ratio <= 1.05) { label = 'Fair';         detail = 'Priced near the market value'; }
    else                    { label = 'Above market'; detail = ((ratio - 1) * 100).toFixed(1) + '% above market'; }

    res.json({
      listing_id: car.id, listing_price: own, median_price: Math.round(market),
      predicted_price: Math.round(market), range_low: low, range_high: high, method,
      label, detail, comparables: method === 'ml' ? undefined : prices.length, basis
    });
  } catch (err) { next(err); }
}

// ── Shortlist (always the logged-in user's own list) ─────────────────────────
function assertSelf(req) {
  if (String(req.params.userId || req.body.user_id) !== String(req.user.id) && req.user.role !== 'admin') {
    throw httpError(403, 'You can only manage your own shortlist');
  }
}

async function shortlist(req, res, next) {
  try {
    assertSelf(req);
    const [rows] = await pool.query(`
      SELECT s.id AS shortlist_id, s.created_at AS saved_at,
             c.id, c.listing_price, c.type, c.year, c.city, c.image_url,
             v.name AS variant_name, m.name AS model_name, b.name AS brand_name
      FROM shortlist s
      JOIN cars c     ON c.id = s.car_id
      JOIN variants v ON v.id = c.variant_id
      JOIN models m   ON m.id = v.model_id
      JOIN brands b   ON b.id = m.brand_id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC, s.id DESC
    `, [req.params.userId]);
    res.json(rows);
  } catch (err) { next(err); }
}

async function addShortlist(req, res, next) {
  try {
    assertSelf(req);
    const { user_id, car_id } = req.body;
    await pool.query('INSERT IGNORE INTO shortlist (user_id, car_id) VALUES (?, ?)', [user_id, car_id]);
    res.status(201).json({ message: 'Added to shortlist' });
  } catch (err) { next(err); }
}

async function removeShortlist(req, res, next) {
  try {
    assertSelf(req);
    await pool.query('DELETE FROM shortlist WHERE user_id = ? AND car_id = ?', [req.params.userId, req.params.carId]);
    res.json({ message: 'Removed from shortlist' });
  } catch (err) { next(err); }
}

module.exports = {
  list, get, variants, create, update, remove, compare, fairPrice,
  shortlist, addShortlist, removeShortlist, groupByModel
};
