/**
 * services/recommender.js — content-based recommender (k-nearest-neighbours in feature space).
 *
 * Every variant becomes a feature vector (price, seating, body type, fuel, efficiency, safety,
 * power, boot space). The quiz answers become a *target* vector in the same space plus a weight
 * per feature (the "what matters most" answer shifts the weights). Variants are ranked by weighted
 * similarity to the target — the nearest neighbours are the recommendations. The same vectors
 * also power "similar cars" (item-to-item nearest neighbours).
 */
'use strict';

const BODIES = ['Hatchback', 'Sedan', 'SUV', 'MUV'];
const FUELS  = ['Petrol', 'Diesel', 'CNG', 'Hybrid', 'Electric'];
const clamp01 = v => Math.max(0, Math.min(1, v));

/** Numeric feature vector of one variant/listing row (all values scaled to 0..1). */
function vectorOf(c) {
  const price = Number(c.listing_price || c.ex_showroom_price || c.price) || 1000000;
  const efficiency = c.fuel_type === 'Electric'
    ? clamp01((Number(c.range_km) || 300) / 500)                       // EVs: range
    : clamp01((Number(c.mileage_kmpl) || 15) / (c.fuel_type === 'CNG' ? 35 : 28));
  return {
    price:      clamp01((Math.log(price) - Math.log(400000)) / (Math.log(4000000) - Math.log(400000))),
    seating:    clamp01((Number(c.seating) || 5) / 7),
    safety:     clamp01((Number(c.ncap_stars) || 3) / 5),
    efficiency,
    power:      clamp01((Number(c.power_bhp) || 90) / 250),
    boot:       clamp01((Number(c.boot_space_l) || 300) / 600),
    body:       Object.fromEntries(BODIES.map(b => [b, c.body_type === b ? 1 : 0])),
    fuel:       Object.fromEntries(FUELS.map(f => [f, c.fuel_type === f ? 1 : 0]))
  };
}

const BUDGET_BAND = { 500000: [300000, 500000], 1000000: [500000, 1000000], 2000000: [1000000, 2000000], 9999999: [2000000, 6000000] };
const USAGE_BODY = {
  city:    { Hatchback: 1,   Sedan: 0.6, SUV: 0.5, MUV: 0.25 },
  highway: { Sedan: 1,       SUV: 0.85,  MUV: 0.6, Hatchback: 0.3 },
  mixed:   { SUV: 1,         Sedan: 0.75, Hatchback: 0.6, MUV: 0.6 },
  offroad: { SUV: 1,         MUV: 0.45,  Sedan: 0.1, Hatchback: 0.05 }
};

/** Quiz answers → target vector + feature weights. */
function profileFromAnswers(a) {
  const cap = Number(a.budget) || 1000000;
  const [lo, hi] = BUDGET_BAND[cap] || [cap * 0.5, cap];
  const w = { price: 30, seating: 18, body: 18, fuel: 14, safety: 4, efficiency: 4, power: 4, boot: 3 };
  const t = { lo, hi, seats: Number(a.family) || 4, usage: a.usage || 'mixed', fuel: a.fuel };
  switch (a.priority) {
    case 'mileage': w.efficiency = 16; w.power = 1; break;
    case 'safety':  w.safety = 16; break;
    case 'style':   w.power = 10; w.boot = 4; w.safety = 6; break;
    case 'cost':    w.price = 38; w.efficiency = 10; break;
  }
  return { t, w, priority: a.priority };
}

const rupees = n => '₹' + (n >= 100000 ? (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L' : Math.round(n).toLocaleString('en-IN'));

/** Weighted similarity of one candidate to a quiz profile → { score, breakdown } (score = Σ pts). */
function scoreCandidate(c, prof) {
  const { t, w, priority } = prof;
  const v = vectorOf(c), price = Number(c.listing_price);
  const sims = {}, why = {};

  // price: 1 inside the band, decays outside (harder above the cap than below the floor)
  if (price >= t.lo && price <= t.hi) { sims.price = 1; why.price = 'Within your budget (' + rupees(price) + ')'; }
  else if (price > t.hi) { sims.price = clamp01(1 - (price - t.hi) / (t.hi * 0.35)); why.price = 'Slightly above budget (' + rupees(price) + ')'; }
  else { sims.price = clamp01(1 - (t.lo - price) / (t.lo * 0.9)); why.price = 'Below your budget band — room to spare'; }

  const seats = Number(c.seating) || 5;
  sims.seating = seats >= t.seats ? 1 : clamp01(seats / t.seats - 0.25);
  why.seating = seats >= t.seats ? 'Seats ' + seats + ' — enough for your group' : 'Only ' + seats + ' seats for your group';

  sims.body = (USAGE_BODY[t.usage] || {})[c.body_type] ?? 0.3;
  why.body = c.body_type + ' body suits ' + ({ city: 'city driving', highway: 'highway trips', mixed: 'mixed use', offroad: 'off-road use' }[t.usage] || 'your usage');

  sims.fuel = c.fuel_type === t.fuel ? 1 : 0;
  why.fuel = c.fuel_type === t.fuel ? t.fuel + ' variant' : t.fuel + ' not offered in this variant';

  sims.safety = v.safety;     why.safety = (c.ncap_stars || 3) + '★ safety rating (indicative)';
  sims.efficiency = v.efficiency;
  why.efficiency = c.fuel_type === 'Electric' ? (c.range_km || '—') + ' km range' : (c.mileage_kmpl || '—') + (c.fuel_type === 'CNG' ? ' km/kg' : ' kmpl');
  sims.power = v.power;       why.power = (c.power_bhp || '—') + ' bhp';
  sims.boot = v.boot;         why.boot = (c.boot_space_l || '—') + ' L boot';

  const total = Object.values(w).reduce((s, x) => s + x, 0);
  const breakdown = Object.keys(w).map(k => ({ key: k, reason: why[k], pts: Math.round(100 * w[k] * sims[k] / total) }))
    .filter(b => b.pts > 0).sort((a, b) => b.pts - a.pts);
  const score = Math.min(100, breakdown.reduce((s, b) => s + b.pts, 0));
  return { score, breakdown: breakdown.map(({ reason, pts }) => ({ reason, pts })) };
}

/**
 * Ranks candidate listings for the quiz. One result per CAR (model): the best-matching variant
 * of each car is kept, so variants of the same car never crowd the list.
 */
function recommend(candidates, answers, limit = 6) {
  const prof = profileFromAnswers(answers);
  const bestPerModel = new Map();
  for (const c of candidates) {
    const r = scoreCandidate(c, prof);
    const cur = bestPerModel.get(c.model_id);
    if (!cur || r.score > cur.score || (r.score === cur.score && Number(c.listing_price) < Number(cur.car.listing_price))) {
      bestPerModel.set(c.model_id, { car: c, score: r.score, breakdown: r.breakdown });
    }
  }
  return [...bestPerModel.values()].sort((a, b) => b.score - a.score || Number(a.car.listing_price) - Number(b.car.listing_price)).slice(0, limit);
}

// ── item-to-item similarity ("similar cars") ─────────────────────────────────────────────
function vec(c) {
  const v = vectorOf(c);
  return [v.price * 3, v.seating * 2, v.safety, v.efficiency, v.power, v.boot,
          ...BODIES.map(b => v.body[b] * 2), ...FUELS.map(f => v.fuel[f])];
}
function distance(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); }

/** k nearest other cars (models) to the given one; the model's cheapest variant represents it. */
function similar(target, candidates, k = 4) {
  const tv = vec(target);
  const rep = new Map();                                    // model_id → cheapest available listing
  for (const c of candidates) {
    if (c.model_id === target.model_id) continue;
    const cur = rep.get(c.model_id);
    if (!cur || Number(c.listing_price) < Number(cur.listing_price)) rep.set(c.model_id, c);
  }
  return [...rep.values()].map(c => ({ car: c, d: distance(tv, vec(c)) })).sort((a, b) => a.d - b.d).slice(0, k)
    .map(x => ({ ...x.car, similarity: Math.round(100 / (1 + x.d)) }));
}

module.exports = { recommend, similar, scoreCandidate, profileFromAnswers, vectorOf };
