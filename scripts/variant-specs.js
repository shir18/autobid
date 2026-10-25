/**
 * scripts/variant-specs.js — per-variant specification data for the seeder.
 *
 * A CAR (model) such as "Swift" has several VARIANTS (LXI, VXI, ZXI, VXI CNG …).
 * Every variant carries its own fuel, engine, power, torque, mileage, boot space,
 * airbags, weight, feature list and (for EVs) battery / range — so the specs on the
 * car page change when the buyer picks another variant.
 *
 * The figures are hand-written, indicative demo data (no scraping).
 */
'use strict';

// Extra variants with a different fuel. [name, price, transmission, mileage, engine_cc, fuel]
// (CNG mileage is km/kg, everything else kmpl.)
const EXTRA_VARIANTS = {
  'Swift':   [['VXI CNG',   749900, 'Manual', 32.85, 1197, 'CNG']],
  'Baleno':  [['Delta CNG', 849900, 'Manual', 30.61, 1197, 'CNG']],
  'Brezza':  [['VXI CNG',  1029900, 'Manual', 25.51, 1462, 'CNG']],
  'Ertiga':  [['VXI CNG',  1029900, 'Manual', 26.11, 1462, 'CNG']],
  'i20':     [['Sportz Diesel', 1049900, 'Manual', 25.20, 1493, 'Diesel']],
  'Creta':   [['S Diesel', 1449900, 'Manual', 21.80, 1493, 'Diesel'],
              ['SX(O) Diesel', 1899900, 'Automatic', 19.10, 1493, 'Diesel']],
  'Verna':   [['S Diesel', 1329900, 'Manual', 25.00, 1493, 'Diesel']],
  'Venue':   [['SX Diesel', 1199900, 'Manual', 23.40, 1493, 'Diesel']],
  'Nexon':   [['Creative Diesel', 1099900, 'Manual', 23.22, 1497, 'Diesel']],
  'Punch':   [['Pure CNG', 699900, 'Manual', 26.99, 1199, 'CNG']],
  'Tiago':   [['XM CNG', 649900, 'Manual', 26.49, 1199, 'CNG']],
  'Amaze':   [['S Diesel', 849900, 'Manual', 24.70, 1498, 'Diesel']],
  'Urban Cruiser Hyryder': [['S CNG', 1249900, 'Manual', 26.60, 1462, 'CNG']],
  'Seltos':  [['HTK+ Diesel', 1299900, 'Manual', 20.70, 1493, 'Diesel'],
              ['GTX+ Diesel', 2049900, 'Automatic', 19.10, 1493, 'Diesel']],
  'Sonet':   [['HTK Diesel', 1049900, 'Manual', 22.30, 1493, 'Diesel']],
  'Carens':  [['Prestige Diesel', 1499900, 'Manual', 21.30, 1493, 'Diesel']],
  'Hector':  [['Super Hybrid', 1649900, 'Manual', 15.81, 1451, 'Hybrid']],
  'XUV700':  [['MX Petrol', 1349900, 'Manual', 13.00, 1999, 'Petrol']],
  'Kwid':    [['RXT CNG', 649900, 'Manual', 21.70, 999, 'CNG']],
  'EcoSport':[['Trend Diesel', 999900, 'Manual', 23.00, 1498, 'Diesel']],
};

// Fuel (and occasionally mileage) for the ORIGINAL variants that are not plain petrol.
const FUEL_OVERRIDES = {
  'Nexon|Pure EV':  { fuel: 'Electric' },
  'Nexon|EV Max':   { fuel: 'Electric' },
  'City|eHEV':      { fuel: 'Hybrid' },
  'Urban Cruiser Hyryder|G Hybrid': { fuel: 'Hybrid' },
  'Innova Hycross|G':  { fuel: 'Petrol', mileage: 16.13 },
  'Innova Hycross|GX': { fuel: 'Hybrid' },
  'Innova Hycross|ZX': { fuel: 'Hybrid' },
  'Scorpio-N|Z8':   { fuel: 'Diesel' },
  'XUV700|MX':      { fuel: 'Diesel' },
  'XUV700|AX3':     { fuel: 'Diesel' },
  'XUV700|AX7 L':   { fuel: 'Diesel' },
  'ZS EV|Excite':   { fuel: 'Electric' },
  'ZS EV|Exclusive':{ fuel: 'Electric' },
  'XUV400|EC':      { fuel: 'Electric' },
  'XUV400|EL':      { fuel: 'Electric' }
};

// Base figures per car: p = petrol [bhp, Nm], d = diesel, cng, hyb = hybrid.
const BASE = {
  'Swift':          { p: [80, 112],  cng: [69, 102],  boot: 265, gc: 163, kerb: 905,  ncap: 3 },
  'Baleno':         { p: [88, 113],  cng: [76, 98.5], boot: 318, gc: 170, kerb: 940,  ncap: 3 },
  'Brezza':         { p: [102, 137], cng: [87, 121],  boot: 328, gc: 198, kerb: 1125, ncap: 4 },
  'Ertiga':         { p: [102, 137], cng: [87, 121],  boot: 209, gc: 180, kerb: 1170, ncap: 3 },
  'i20':            { p: [82, 115],  d: [99, 240],    boot: 311, gc: 170, kerb: 1040, ncap: 3 },
  'Creta':          { p: [113, 144], d: [114, 250],   boot: 433, gc: 190, kerb: 1350, ncap: 3 },
  'Verna':          { p: [113, 144], d: [114, 250],   boot: 528, gc: 165, kerb: 1150, ncap: 5 },
  'Venue':          { p: [82, 114],  d: [99, 240],    boot: 350, gc: 190, kerb: 1085, ncap: 3 },
  'Nexon':          { p: [118, 170], d: [113, 260],   boot: 382, gc: 208, kerb: 1305, ncap: 5 },
  'Punch':          { p: [87, 115],  cng: [72, 103],  boot: 366, gc: 187, kerb: 1010, ncap: 5 },
  'Tiago':          { p: [84, 113],  cng: [72, 95],   boot: 242, gc: 170, kerb: 940,  ncap: 4 },
  'Harrier':        { d: [167, 350],                  boot: 445, gc: 205, kerb: 1675, ncap: 5 },
  'City':           { p: [119, 145], hyb: [124, 253], boot: 506, gc: 165, kerb: 1150, ncap: 4 },
  'Amaze':          { p: [89, 110],  d: [98, 200],    boot: 420, gc: 165, kerb: 940,  ncap: 2 },
  'Elevate':        { p: [119, 145],                  boot: 458, gc: 220, kerb: 1250, ncap: 5 },
  'Innova Hycross': { p: [172, 205], hyb: [184, 188], boot: 300, gc: 185, kerb: 1800, ncap: 5 },
  'Fortuner':       { d: [201, 500],                  boot: 296, gc: 225, kerb: 2135, ncap: 5 },
  'Urban Cruiser Hyryder': { p: [102, 137], hyb: [114, 141], cng: [87, 121], boot: 373, gc: 210, kerb: 1250, ncap: 3 },
  'Seltos':         { p: [113, 144], d: [114, 250],   boot: 433, gc: 190, kerb: 1350, ncap: 3 },
  'Sonet':          { p: [82, 115],  d: [113, 250],   boot: 392, gc: 211, kerb: 1150, ncap: 3 },
  'Carens':         { p: [113, 144], d: [114, 250],   boot: 216, gc: 190, kerb: 1350, ncap: 3 },
  'Hector':         { p: [141, 250], hyb: [141, 250], boot: 587, gc: 192, kerb: 1600, ncap: 4 },
  'ZS EV':          { boot: 448, gc: 177, kerb: 1620, ncap: 5 },
  'Scorpio-N':      { p: [200, 380], d: [172, 400],   boot: 460, gc: 187, kerb: 1900, ncap: 5 },
  'XUV700':         { p: [197, 380], d: [182, 450],   boot: 400, gc: 200, kerb: 1900, ncap: 5 },
  'XUV400':         { boot: 378, gc: 200, kerb: 1550, ncap: 5 },
  'Taigun':         { p: [113, 178],                  boot: 385, gc: 188, kerb: 1230, ncap: 5 },
  'Slavia':         { p: [113, 178],                  boot: 521, gc: 179, kerb: 1200, ncap: 5 },
  'Kwid':           { p: [67, 91],   cng: [56, 80],   boot: 279, gc: 184, kerb: 825,  ncap: 2 },
  'EcoSport':       { p: [120, 149], d: [99, 215],    boot: 352, gc: 200, kerb: 1300, ncap: 4 }
};

// Electric variants: [bhp, Nm, battery kWh, range km]
const EV = {
  'Nexon|Pure EV':   [127, 215, 30.2, 325],
  'Nexon|EV Max':    [141, 215, 40.5, 453],
  'ZS EV|Excite':    [174, 280, 50.3, 461],
  'ZS EV|Exclusive': [174, 280, 50.3, 461],
  'XUV400|EC':       [147, 310, 34.5, 375],
  'XUV400|EL':       [147, 310, 39.4, 456]
};

// Cumulative feature ladder — higher trims get more.
const LADDER = [
  ['Dual front airbags', 'ABS with EBD', 'Power steering', 'Central locking', 'Rear seat belts'],
  ['Touchscreen infotainment', 'Rear parking sensors', 'Power windows', 'Steering audio controls', 'Bluetooth & USB'],
  ['Alloy wheels', 'Reverse camera', 'Auto climate control', 'Cruise control', 'Push-button start', 'Android Auto / Apple CarPlay'],
  ['Sunroof', 'Wireless charging', 'Connected car tech', 'Ventilated front seats', '360° camera', 'LED headlamps & DRLs']
];

function fuelFor(modelName, variantName, extraFuel) {
  if (extraFuel) return extraFuel;
  const o = FUEL_OVERRIDES[modelName + '|' + variantName];
  if (o && o.fuel) return o.fuel;
  const b = BASE[modelName] || {};
  if (b.p) return 'Petrol';
  if (b.d) return 'Diesel';
  return 'Electric';
}

/**
 * Builds the spec columns for one variant.
 * @param {string} modelName
 * @param {string} variantName
 * @param {number} tier     position of this variant inside its car, ordered by price (0 = base)
 * @param {number} tiers    number of variants of the car
 * @param {{fuel?:string, transmission:string}} v
 */
function buildSpecs(modelName, variantName, tier, tiers, v) {
  const base = BASE[modelName] || { boot: 350, gc: 170, kerb: 1100, ncap: 3, p: [90, 120] };
  const fuel = fuelFor(modelName, variantName, v.fuel);
  const f = tiers > 1 ? tier / (tiers - 1) : 0;
  const key = modelName + '|' + variantName;

  let power = null, torque = null, battery = null, range = null;
  let boot = base.boot, kerb = base.kerb + tier * 12 + (v.transmission === 'Automatic' ? 25 : 0);

  if (fuel === 'Electric') {
    const ev = EV[key] || [140, 250, 40, 400];
    [power, torque, battery, range] = ev;
    kerb += 180;
  } else {
    const pick = { Petrol: base.p, Diesel: base.d, CNG: base.cng, Hybrid: base.hyb }[fuel] || base.p || base.d;
    if (pick) { power = pick[0]; torque = pick[1]; }
    if (fuel === 'Diesel') kerb += 80;
    if (fuel === 'Hybrid') kerb += 90;
    if (fuel === 'CNG')  { kerb += 45; boot = Math.round(boot * 0.6); }   // CNG tank eats boot space
  }

  const airbags = base.ncap >= 5 ? (f < 0.34 ? 2 : 6) : (f < 0.34 ? 2 : f < 0.67 ? 4 : 6);
  const level = f < 0.2 ? 0 : f < 0.5 ? 1 : f < 0.8 ? 2 : 3;
  const features = [];
  for (let i = 0; i <= level; i++) features.push(...LADDER[i]);
  if (airbags >= 6) features.push('6 airbags');
  if (v.transmission === 'Automatic') features.push('Automatic transmission');
  if (fuel === 'Electric') features.push('Regenerative braking', 'DC fast charging');
  if (fuel === 'Hybrid') features.push('Strong-hybrid EV mode');
  if (fuel === 'CNG') features.push('Factory-fitted CNG kit');

  return {
    fuel_type: fuel, power_bhp: power, torque_nm: torque, boot_space_l: boot, airbags,
    ncap_stars: base.ncap, ground_clearance_mm: base.gc, kerb_weight_kg: kerb,
    battery_kwh: battery, range_km: range, features: JSON.stringify(features)
  };
}

/** Full variant list of a car: the original templates + the extra fuel variants, ordered by price. */
function allVariantsFor(modelName, templates) {
  const rows = (templates || []).map(([name, price, trans, mileage, engine]) => {
    const o = FUEL_OVERRIDES[modelName + '|' + name] || {};
    return { name, price, transmission: trans, mileage: o.mileage !== undefined ? o.mileage : mileage, engine, fuel: o.fuel };
  });
  for (const [name, price, trans, mileage, engine, fuel] of (EXTRA_VARIANTS[modelName] || [])) {
    rows.push({ name, price, transmission: trans, mileage, engine, fuel });
  }
  rows.sort((a, b) => a.price - b.price);
  return rows;
}

module.exports = { buildSpecs, allVariantsFor, fuelFor, BASE };
