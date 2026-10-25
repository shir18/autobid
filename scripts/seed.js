/**
 * scripts/seed.js — AutoBid database seeder
 * Run: node scripts/seed.js
 *
 * Seeds: 12 brands, 30 cars (models), ~120 variants with per-variant specs, 40 used listings, 10 dealers,
 *        3 users, sample requirements with offers each.
 * No external data is scraped. All data is hand-written.
 */
'use strict';
const bcrypt = require('bcryptjs');
const fs     = require('fs');
const path   = require('path');
const pool   = require('../db');   // engine-agnostic (MySQL or embedded SQLite)
const { buildSpecs, allVariantsFor } = require('./variant-specs');

// ── SEED DATA ──────────────────────────────────────────────────────────────────

const brands = [
  { name: 'Maruti Suzuki', slug: 'maruti-suzuki' },
  { name: 'Hyundai',       slug: 'hyundai' },
  { name: 'Tata Motors',   slug: 'tata-motors' },
  { name: 'Honda',         slug: 'honda' },
  { name: 'Toyota',        slug: 'toyota' },
  { name: 'Kia',           slug: 'kia' },
  { name: 'MG Motor',      slug: 'mg-motor' },
  { name: 'Mahindra',      slug: 'mahindra' },
  { name: 'Volkswagen',    slug: 'volkswagen' },
  { name: 'Skoda',         slug: 'skoda' },
  { name: 'Renault',       slug: 'renault' },
  { name: 'Ford',          slug: 'ford' }
];

// [brand_slug, name, body_type, fuel_type, seating]
const models = [
  ['maruti-suzuki', 'Swift',       'Hatchback', 'Petrol,CNG', 5],
  ['maruti-suzuki', 'Baleno',      'Hatchback', 'Petrol',     5],
  ['maruti-suzuki', 'Brezza',      'SUV',       'Petrol,CNG', 5],
  ['maruti-suzuki', 'Ertiga',      'MUV',       'Petrol,CNG', 7],
  ['hyundai',       'i20',         'Hatchback', 'Petrol,Diesel', 5],
  ['hyundai',       'Creta',       'SUV',       'Petrol,Diesel', 5],
  ['hyundai',       'Verna',       'Sedan',     'Petrol,Diesel', 5],
  ['hyundai',       'Venue',       'SUV',       'Petrol,Diesel,CNG', 5],
  ['tata-motors',   'Nexon',       'SUV',       'Petrol,Diesel,Electric', 5],
  ['tata-motors',   'Punch',       'SUV',       'Petrol',     5],
  ['tata-motors',   'Tiago',       'Hatchback', 'Petrol,CNG', 5],
  ['tata-motors',   'Harrier',     'SUV',       'Diesel',     5],
  ['honda',         'City',        'Sedan',     'Petrol,Hybrid', 5],
  ['honda',         'Amaze',       'Sedan',     'Petrol,Diesel', 5],
  ['honda',         'Elevate',     'SUV',       'Petrol',     5],
  ['toyota',        'Innova Hycross', 'MUV',   'Petrol,Hybrid', 7],
  ['toyota',        'Fortuner',    'SUV',       'Diesel',     7],
  ['toyota',        'Urban Cruiser Hyryder', 'SUV', 'Petrol,Hybrid', 5],
  ['kia',           'Seltos',      'SUV',       'Petrol,Diesel', 5],
  ['kia',           'Sonet',       'SUV',       'Petrol,Diesel', 5],
  ['kia',           'Carens',      'MUV',       'Petrol,Diesel', 6],
  ['mg-motor',      'Hector',      'SUV',       'Petrol,Hybrid', 5],
  ['mg-motor',      'ZS EV',       'SUV',       'Electric',   5],
  ['mahindra',      'Scorpio-N',   'SUV',       'Petrol,Diesel', 7],
  ['mahindra',      'XUV700',      'SUV',       'Petrol,Diesel', 7],
  ['mahindra',      'XUV400',      'SUV',       'Electric',   5],
  ['volkswagen',    'Taigun',      'SUV',       'Petrol',     5],
  ['skoda',         'Slavia',      'Sedan',     'Petrol',     5],
  ['renault',       'Kwid',        'Hatchback', 'Petrol,CNG', 5],
  ['ford',          'EcoSport',    'SUV',       'Petrol,Diesel', 5]
];

// Variants: [model_slug_partial, name, price, transmission, mileage, engine_cc]
// We'll build this dynamically from model IDs
const variantTemplates = {
  'Swift':       [
    ['LXI',    549900,  'Manual',    23.2, 1197],
    ['VXI',    649900,  'Manual',    23.2, 1197],
    ['ZXI',    789900,  'Manual',    23.2, 1197],
    ['ZXI+',   849900,  'Automatic', 22.6, 1197],
  ],
  'Baleno':      [
    ['Sigma',  649900,  'Manual',    22.3, 1197],
    ['Delta',  749900,  'Manual',    22.3, 1197],
    ['Zeta',   849900,  'Automatic', 22.9, 1197],
    ['Alpha',  949900,  'Automatic', 22.9, 1197],
  ],
  'Brezza':      [
    ['LXI',    799900,  'Manual',    17.4, 1462],
    ['VXI',    909900,  'Manual',    17.4, 1462],
    ['ZXI',   1079900,  'Automatic', 19.8, 1462],
    ['ZXI+',  1209900,  'Automatic', 19.8, 1462],
  ],
  'Ertiga':      [
    ['VXI',    899900,  'Manual',    20.3, 1462],
    ['ZXI',   1049900,  'Manual',    20.3, 1462],
    ['ZXI+',  1159900,  'Automatic', 19.3, 1462],
  ],
  'i20':         [
    ['Era',    699900,  'Manual',    20.35, 1197],
    ['Magna',  799900,  'Manual',    20.35, 1197],
    ['Sportz', 949900,  'Manual',    20.35, 1197],
    ['Asta',  1049900,  'Automatic', 19.65, 1197],
  ],
  'Creta':       [
    ['E',      1000000, 'Manual',    17.0, 1497],
    ['EX',     1150000, 'Manual',    17.0, 1497],
    ['S',      1299900, 'Automatic', 18.3, 1497],
    ['SX',     1699900, 'Automatic', 18.3, 1497],
  ],
  'Verna':       [
    ['EX',      999900, 'Manual',    20.6, 1497],
    ['S',      1199900, 'Manual',    20.6, 1497],
    ['SX',     1499900, 'Automatic', 20.6, 1497],
  ],
  'Venue':       [
    ['E',       769900, 'Manual',    18.15, 1197],
    ['S',       909900, 'Manual',    18.15, 1197],
    ['SX',     1099900, 'Automatic', 17.5, 1197],
  ],
  'Nexon':       [
    ['Smart',   799900, 'Manual',    17.38, 1497],
    ['Smart+',  909900, 'Manual',    17.38, 1497],
    ['Pure EV',1499900, 'Automatic', null, null],
    ['EV Max', 1899900, 'Automatic', null, null],
  ],
  'Punch':       [
    ['Pure',    599900, 'Manual',    18.97, 1199],
    ['Adventure',699900,'Manual',   18.97, 1199],
    ['Accomplished',789900,'Automatic',18.8,1199],
  ],
  'Tiago':       [
    ['XE',      499900, 'Manual',    19.01, 1199],
    ['XM',      579900, 'Manual',    19.01, 1199],
    ['XZ',      699900, 'Automatic', 19.8, 1199],
  ],
  'Harrier':     [
    ['Smart',  1499900, 'Manual',    16.35, 1956],
    ['Pure',   1699900, 'Manual',    16.35, 1956],
    ['Adventure',1999900,'Automatic',14.63,1956],
  ],
  'City':        [
    ['V',       999900, 'Manual',    17.8, 1497],
    ['VX',     1149900, 'Manual',    17.8, 1497],
    ['ZX',     1399900, 'Automatic', 18.4, 1497],
    ['eHEV',   1899900, 'Automatic', 26.5, 1497],
  ],
  'Amaze':       [
    ['E',       699900, 'Manual',    18.6, 1199],
    ['S',       799900, 'Manual',    18.6, 1199],
    ['V',       899900, 'Automatic', 18.0, 1199],
  ],
  'Elevate':     [
    ['S',      1099900, 'Manual',    15.55, 1497],
    ['SX',     1349900, 'Manual',    15.55, 1497],
    ['SX(O)', 1549900,  'Automatic', 16.92, 1497],
  ],
  'Innova Hycross':[
    ['G',      1849900, 'Automatic', 21.1, 1987],
    ['GX',     2099900, 'Automatic', 21.1, 1987],
    ['ZX',     2699900, 'Automatic', 21.1, 1987],
  ],
  'Fortuner':    [
    ['4x2 MT', 3299900, 'Manual',    14.24, 2755],
    ['4x2 AT', 3549900, 'Automatic', 14.24, 2755],
    ['Legender',3899900,'Automatic', 14.24, 2755],
  ],
  'Urban Cruiser Hyryder':[
    ['E',       999900, 'Manual',    21.14, 1490],
    ['S',      1149900, 'Manual',    21.14, 1490],
    ['G Hybrid',1599900,'Automatic', 27.97, 1490],
  ],
  'Seltos':      [
    ['HTE',     999900, 'Manual',    16.5, 1497],
    ['HTK',    1149900, 'Manual',    16.5, 1497],
    ['HTX',    1399900, 'Automatic', 16.3, 1497],
    ['GTX+',   1949900, 'Automatic', 16.3, 1497],
  ],
  'Sonet':       [
    ['HTE',     799900, 'Manual',    18.3, 1197],
    ['HTK',     909900, 'Manual',    18.3, 1197],
    ['HTX',    1099900, 'Automatic', 18.2, 1197],
  ],
  'Carens':      [
    ['Premium', 1099900,'Manual',    17.35, 1497],
    ['Prestige',1299900,'Manual',    17.35, 1497],
    ['Luxury', 1699900, 'Automatic', 17.35, 1497],
  ],
  'Hector':      [
    ['Style',  1399900, 'Manual',    15.78, 1451],
    ['Super',  1549900, 'Manual',    15.78, 1451],
    ['Sharp',  1849900, 'Automatic', 14.2,  1451],
  ],
  'ZS EV':       [
    ['Excite', 2199900, 'Automatic', null, null],
    ['Exclusive',2499900,'Automatic',null, null],
  ],
  'Scorpio-N':   [
    ['Z2',     1349900, 'Manual',    15.2, 1997],
    ['Z4',     1599900, 'Manual',    15.2, 1997],
    ['Z8',     2249900, 'Automatic', 15.2, 2184],
  ],
  'XUV700':      [
    ['MX',     1399900, 'Manual',    14.98, 2184],
    ['AX3',    1699900, 'Automatic', 14.98, 2184],
    ['AX7 L',  2599900, 'Automatic', 14.98, 2184],
  ],
  'XUV400':      [
    ['EC',     1599900, 'Automatic', null, null],
    ['EL',     1889900, 'Automatic', null, null],
  ],
  'Taigun':      [
    ['Comfortline', 1199900,'Manual',16.35, 999],
    ['Trendline',  1399900,'Automatic',16.35,999],
    ['Topline',    1799900,'Automatic',16.35,999],
  ],
  'Slavia':      [
    ['Active',  1099900, 'Manual',   18.68, 999],
    ['Ambition',1299900, 'Manual',   18.68, 999],
    ['Style',  1549900,  'Automatic',17.85, 1498],
  ],
  'Kwid':        [
    ['STD',     449900, 'Manual',    22.3, 999],
    ['RXE',     499900, 'Manual',    22.3, 999],
    ['RXT',     599900, 'Automatic', 22.3, 999],
  ],
  'EcoSport':    [
    ['Ambiente', 799900, 'Manual',   17.0, 1497],
    ['Trend',    899900, 'Manual',   17.0, 1497],
    ['Titanium', 1099900,'Automatic',16.0, 1497],
  ],
};

const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad'];

const dealerData = [
  { name: 'AutoBid Mumbai Central',    city: 'Mumbai',    address: 'Worli, Mumbai 400018',             lat: 19.0176, lng: 72.8156 },
  { name: 'AutoBid Mumbai West',       city: 'Mumbai',    address: 'Andheri West, Mumbai 400058',      lat: 19.1197, lng: 72.8464 },
  { name: 'AutoBid Delhi North',       city: 'Delhi',     address: 'Rohini, Delhi 110085',             lat: 28.7041, lng: 77.1025 },
  { name: 'AutoBid Delhi South',       city: 'Delhi',     address: 'Saket, Delhi 110017',              lat: 28.5244, lng: 77.2094 },
  { name: 'AutoBid Bangalore East',    city: 'Bangalore', address: 'Whitefield, Bangalore 560066',     lat: 12.9698, lng: 77.7499 },
  { name: 'AutoBid Bangalore Central', city: 'Bangalore', address: 'Indiranagar, Bangalore 560038',    lat: 12.9783, lng: 77.6408 },
  { name: 'AutoBid Chennai OMR',       city: 'Chennai',   address: 'OMR Road, Chennai 600119',         lat: 12.8397, lng: 80.2251 },
  { name: 'AutoBid Chennai West',      city: 'Chennai',   address: 'Ambattur, Chennai 600053',         lat: 13.1067, lng: 80.1549 },
  { name: 'AutoBid Hyderabad HITEC',   city: 'Hyderabad', address: 'HITEC City, Hyderabad 500081',     lat: 17.4474, lng: 78.3762 },
  { name: 'AutoBid Hyderabad Old City',city: 'Hyderabad', address: 'Mehdipatnam, Hyderabad 500028',    lat: 17.3950, lng: 78.4371 },
];

const usedCarTemplates = [
  { model: 'Swift',   year: 2021, km: 28000, owners: 1, price: 580000,  city: 'Mumbai' },
  { model: 'Swift',   year: 2019, km: 55000, owners: 2, price: 450000,  city: 'Delhi' },
  { model: 'Baleno',  year: 2022, km: 15000, owners: 1, price: 720000,  city: 'Bangalore' },
  { model: 'Creta',   year: 2020, km: 42000, owners: 1, price: 1050000, city: 'Mumbai' },
  { model: 'Creta',   year: 2018, km: 78000, owners: 2, price: 750000,  city: 'Chennai' },
  { model: 'Nexon',   year: 2021, km: 32000, owners: 1, price: 870000,  city: 'Hyderabad' },
  { model: 'i20',     year: 2020, km: 38000, owners: 1, price: 680000,  city: 'Delhi' },
  { model: 'Brezza',  year: 2021, km: 25000, owners: 1, price: 960000,  city: 'Bangalore' },
  { model: 'City',    year: 2019, km: 52000, owners: 2, price: 820000,  city: 'Mumbai' },
  { model: 'Seltos',  year: 2022, km: 18000, owners: 1, price: 1250000, city: 'Hyderabad' },
  { model: 'Venue',   year: 2021, km: 30000, owners: 1, price: 790000,  city: 'Chennai' },
  { model: 'Sonet',   year: 2022, km: 12000, owners: 1, price: 890000,  city: 'Bangalore' },
  { model: 'Punch',   year: 2023, km: 8000,  owners: 1, price: 720000,  city: 'Delhi' },
  { model: 'Tiago',   year: 2020, km: 44000, owners: 2, price: 380000,  city: 'Mumbai' },
  { model: 'Amaze',   year: 2021, km: 29000, owners: 1, price: 720000,  city: 'Chennai' },
  { model: 'Verna',   year: 2020, km: 41000, owners: 1, price: 880000,  city: 'Delhi' },
  { model: 'Kwid',    year: 2020, km: 33000, owners: 1, price: 340000,  city: 'Hyderabad' },
  { model: 'Hector',  year: 2021, km: 36000, owners: 1, price: 1380000, city: 'Bangalore' },
  { model: 'Taigun',  year: 2022, km: 22000, owners: 1, price: 1280000, city: 'Mumbai' },
  { model: 'Slavia',  year: 2022, km: 19000, owners: 1, price: 1120000, city: 'Delhi' },
  { model: 'Ertiga',  year: 2020, km: 48000, owners: 1, price: 820000,  city: 'Chennai' },
  { model: 'Fortuner',year: 2019, km: 65000, owners: 2, price: 2800000, city: 'Mumbai' },
  { model: 'Scorpio-N',year:2022, km: 24000, owners: 1, price: 1620000, city: 'Hyderabad' },
  { model: 'XUV700',  year: 2022, km: 20000, owners: 1, price: 1800000, city: 'Bangalore' },
  { model: 'Harrier',  year: 2021, km: 31000, owners: 1, price: 1620000, city: 'Delhi' },
  { model: 'EcoSport', year: 2019, km: 59000, owners: 2, price: 680000, city: 'Chennai' },
  { model: 'Elevate',  year: 2023, km: 6000,  owners: 1, price: 1300000, city: 'Mumbai' },
  { model: 'Carens',   year: 2022, km: 16000, owners: 1, price: 1080000, city: 'Bangalore' },
  { model: 'ZS EV',    year: 2021, km: 27000, owners: 1, price: 1650000, city: 'Delhi' },
  { model: 'Urban Cruiser Hyryder', year: 2022, km: 14000, owners: 1, price: 1390000, city: 'Hyderabad' },
  { model: 'Swift',    year: 2017, km: 85000, owners: 3, price: 320000, city: 'Mumbai' },
  { model: 'i20',      year: 2022, km: 11000, owners: 1, price: 810000, city: 'Chennai' },
  { model: 'City',     year: 2021, km: 23000, owners: 1, price: 1080000, city: 'Bangalore' },
  { model: 'Baleno',   year: 2020, km: 37000, owners: 1, price: 620000, city: 'Delhi' },
  { model: 'Creta',    year: 2021, km: 28000, owners: 1, price: 1180000, city: 'Hyderabad' },
  { model: 'Nexon',    year: 2022, km: 17000, owners: 1, price: 950000, city: 'Mumbai' },
  { model: 'Venue',    year: 2020, km: 43000, owners: 2, price: 700000, city: 'Bangalore' },
  { model: 'XUV400',   year: 2023, km: 5000,  owners: 1, price: 1750000, city: 'Delhi' },
  { model: 'Innova Hycross', year: 2023, km: 9000, owners: 1, price: 2100000, city: 'Chennai' },
  { model: 'Brezza',   year: 2022, km: 14000, owners: 1, price: 1050000, city: 'Hyderabad' },
];

// ── Car image paths (local files in public/img/cars/) ─────────────────────────
// To add a real image: download a .jpg photo of the car and save it to
//   public/img/cars/<filename>.jpg
// The filename must match the key below (lowercase, hyphens for spaces).
// Example: save a Hyundai Creta photo as public/img/cars/creta.jpg
const carImages = {
  'Swift':                    '/img/cars/swift.jpg',
  'Baleno':                   '/img/cars/baleno.jpg',
  'Brezza':                   '/img/cars/brezza.jpg',
  'Ertiga':                   '/img/cars/ertiga.jpg',
  'i20':                      '/img/cars/i20.jpg',
  'Creta':                    '/img/cars/creta.jpg',
  'Verna':                    '/img/cars/verna.jpg',
  'Venue':                    '/img/cars/venue.jpg',
  'Nexon':                    '/img/cars/nexon.jpg',
  'Punch':                    '/img/cars/punch.jpg',
  'Tiago':                    '/img/cars/tiago.jpg',
  'Harrier':                  '/img/cars/harrier.jpg',
  'City':                     '/img/cars/city.jpg',
  'Amaze':                    '/img/cars/amaze.jpg',
  'Elevate':                  '/img/cars/elevate.jpg',
  'Innova Hycross':           '/img/cars/innova-hycross.jpg',
  'Fortuner':                 '/img/cars/fortuner.jpg',
  'Urban Cruiser Hyryder':    '/img/cars/urban-cruiser-hyryder.jpg',
  'Seltos':                   '/img/cars/seltos.jpg',
  'Sonet':                    '/img/cars/sonet.jpg',
  'Carens':                   '/img/cars/carens.jpg',
  'Hector':                   '/img/cars/hector.jpg',
  'ZS EV':                    '/img/cars/zs-ev.jpg',
  'Scorpio-N':                '/img/cars/scorpio-n.jpg',
  'XUV700':                   '/img/cars/xuv700.jpg',
  'XUV400':                   '/img/cars/xuv400.jpg',
  'Taigun':                   '/img/cars/taigun.jpg',
  'Slavia':                   '/img/cars/slavia.jpg',
  'Kwid':                     '/img/cars/kwid.jpg',
  'EcoSport':                 '/img/cars/ecosport.jpg',
};

function getCarImage(modelName) {
  return carImages[modelName] || '/img/car-placeholder.svg';
}

// ── MAIN SEED FUNCTION ────────────────────────────────────────────────────────
async function seed() {
  console.log('[seed] Starting AutoBid database seed (' + pool.engine + ')...');

  // Load and run the schema that matches the active engine (drops + recreates every table)
  const schemaFile = pool.engine === 'sqlite' ? 'schema.sqlite.sql' : 'schema.sql';
  const schema = fs.readFileSync(path.join(__dirname, '..', 'sql', schemaFile), 'utf8');
  await pool.execScript(schema);
  console.log('[seed] Schema applied');

  // 3 demo users
  const pwBuyer  = await bcrypt.hash('buyer123', 10);
  const pwDealer = await bcrypt.hash('dealer123', 10);
  const pwAdmin  = await bcrypt.hash('admin123', 10);

  // 10 extra dealer users
  const dealerPw = await bcrypt.hash('dealer123', 10);

  const [buyerRes]  = await pool.query('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',  ['buyer@demo.com',  pwBuyer,  'Arjun Mehta',    'buyer']);
  const [dealerRes] = await pool.query('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)', ['dealer@demo.com', pwDealer, 'Dealer One',     'dealer']);
  const [adminRes]  = await pool.query('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)', ['admin@demo.com',  pwAdmin,  'Admin AutoBid',  'admin']);

  const buyerId  = buyerRes.insertId;
  const dealerUserId = dealerRes.insertId;
  console.log('[seed] Demo users created');

  // 10 dealer users + dealer records
  const dealerIds = [];
  for (let i = 0; i < dealerData.length; i++) {
    let userEmail, userId;
    if (i === 0) {
      // Reuse the demo dealer user for first dealer
      userId = dealerUserId;
    } else {
      const [ur] = await pool.query(
        'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
        [`dealer${i + 1}@demo.com`, dealerPw, `Dealer ${i + 1}`, 'dealer']
      );
      userId = ur.insertId;
    }
    const dd = dealerData[i];
    const [dr] = await pool.query(
      'INSERT INTO dealers (user_id, name, city, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, dd.name, dd.city, dd.address, dd.lat, dd.lng]
    );
    dealerIds.push(dr.insertId);
  }
  console.log('[seed] Dealers created:', dealerIds.length);

  // Brands
  const brandIdMap = {};
  for (const b of brands) {
    const [r] = await pool.query('INSERT INTO brands (name, slug) VALUES (?, ?)', [b.name, b.slug]);
    brandIdMap[b.slug] = r.insertId;
  }
  console.log('[seed] Brands created:', Object.keys(brandIdMap).length);

  // Models
  const modelIdMap = {};
  for (const [brandSlug, name, bodyType, fuelType, seating] of models) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const [r] = await pool.query(
      'INSERT INTO models (brand_id, name, slug, body_type, fuel_type, seating) VALUES (?, ?, ?, ?, ?, ?)',
      [brandIdMap[brandSlug], name, slug, bodyType, fuelType, seating]
    );
    modelIdMap[name] = r.insertId;
  }
  console.log('[seed] Models created:', Object.keys(modelIdMap).length);

  // Variants — each car gets its full variant list (incl. CNG / diesel / hybrid / EV variants),
  // and every variant stores its own specs (fuel, power, torque, boot, airbags, features …).
  const variantIdMap = {};  // model_name -> variant ids (ordered by price)
  const variantsByModel = {};
  const variantRows = {};   // model_name -> [{id, price, ...}]
  for (const [modelName, templates] of Object.entries(variantTemplates)) {
    const modelId = modelIdMap[modelName];
    if (!modelId) continue;
    variantIdMap[modelName] = [];
    variantRows[modelName]  = [];
    const list = allVariantsFor(modelName, templates);
    const fuels = [];
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      const sp = buildSpecs(modelName, v.name, i, list.length, { fuel: v.fuel, transmission: v.transmission });
      if (!fuels.includes(sp.fuel_type)) fuels.push(sp.fuel_type);
      const colors = JSON.stringify(['White', 'Silver', 'Red', 'Blue', 'Grey']);
      const [r] = await pool.query(
        `INSERT INTO variants (model_id, name, price, transmission, mileage_kmpl, engine_cc, color_options,
                               fuel_type, power_bhp, torque_nm, boot_space_l, airbags, ncap_stars,
                               ground_clearance_mm, kerb_weight_kg, battery_kwh, range_km, features)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [modelId, v.name, v.price, v.transmission, v.mileage || null, v.engine || null, colors,
         sp.fuel_type, sp.power_bhp, sp.torque_nm, sp.boot_space_l, sp.airbags, sp.ncap_stars,
         sp.ground_clearance_mm, sp.kerb_weight_kg, sp.battery_kwh, sp.range_km, sp.features]
      );
      variantIdMap[modelName].push(r.insertId);
      variantRows[modelName].push({ id: r.insertId, price: v.price });
    }
    // The car's fuel options are the union of what its variants offer
    await pool.query('UPDATE models SET fuel_type = ? WHERE id = ?', [fuels.join(','), modelId]);
    variantsByModel[modelName] = variantIdMap[modelName];
  }
  console.log('[seed] Variants created');

  // New car listings (one per variant, spread across cities/dealers)
  let newCarCount = 0;
  for (const [modelName, variantIds] of Object.entries(variantsByModel)) {
    for (let vi = 0; vi < variantIds.length; vi++) {
      const varId   = variantIds[vi];
      const city    = cities[newCarCount % cities.length];
      const dealer  = dealerIds[newCarCount % dealerIds.length];
      // Get variant price for listing
      const [vrows] = await pool.query('SELECT price FROM variants WHERE id = ?', [varId]);
      const price   = vrows[0]?.price || 1000000;
      await pool.query(
        'INSERT INTO cars (variant_id, type, year, city, listing_price, dealer_id, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [varId, 'new', 2024, city, price, dealer, getCarImage(modelName)]
      );
      newCarCount++;
    }
  }
  console.log('[seed] New car listings created:', newCarCount);

  // Used car listings
  for (let i = 0; i < usedCarTemplates.length; i++) {
    const uc = usedCarTemplates[i];
    const varIds = variantsByModel[uc.model];
    if (!varIds || !varIds.length) continue;
    // pick the variant whose age-depreciated ex-showroom price is closest to the asking price
    const age = Math.max(0, 2026 - uc.year);
    const dep = Math.max(0.35, 1 - 0.15 - 0.09 * Math.max(0, age - 1));
    let varId = varIds[0], bestGap = Infinity;
    for (const vr of variantRows[uc.model]) {
      const gap = Math.abs(Number(vr.price) * dep - uc.price);
      if (gap < bestGap) { bestGap = gap; varId = vr.id; }
    }
    const dealer = dealerIds[i % dealerIds.length];
    await pool.query(
      'INSERT INTO cars (variant_id, type, year, km_driven, owner_count, city, listing_price, dealer_id, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [varId, 'used', uc.year, uc.km, uc.owners, uc.city, uc.price, dealer, getCarImage(uc.model)]
    );
  }
  console.log('[seed] Used car listings created:', usedCarTemplates.length);

  // Sample requirements (3, one per city) + 3 offers each
  const reqData = [
    { budget_min: 800000,  budget_max: 1200000, body_type: 'SUV',       fuel: 'Petrol',  city: 'Mumbai',    timeline: 30 },
    { budget_min: 500000,  budget_max: 800000,  body_type: 'Hatchback', fuel: 'Petrol',  city: 'Delhi',     timeline: 45 },
    { budget_min: 1500000, budget_max: 2500000, body_type: 'SUV',       fuel: 'Diesel',  city: 'Bangalore', timeline: 20 },
  ];

  for (const rq of reqData) {
    const [rr] = await pool.query(
      'INSERT INTO requirements (buyer_id, budget_min, budget_max, body_type, fuel, city, timeline_days) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [buyerId, rq.budget_min, rq.budget_max, rq.body_type, rq.fuel, rq.city, rq.timeline]
    );
    const reqId = rr.insertId;
    // 3 offers per requirement from different dealers
    for (let d = 0; d < 3; d++) {
      const dealerId = dealerIds[d + 1];   // demo dealer (index 0) is left free to place a fresh bid
      const price    = Math.round((rq.budget_min + (rq.budget_max - rq.budget_min) * (0.55 + 0.15 * d)) / 1000) * 1000;
      const freebies = ['Free 3-year servicing', 'Extended warranty', 'Free accessories worth ₹20,000'][d];
      await pool.query(
        'INSERT INTO offers (requirement_id, dealer_id, price, delivery_days, freebies) VALUES (?, ?, ?, ?, ?)',
        [reqId, dealerId, price, 7 + d * 7, freebies]
      );
    }
  }
  console.log('[seed] Sample requirements and offers created');

  // One upcoming test drive for the demo buyer
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await pool.query(
    'INSERT INTO bookings (car_id, user_id, dealer_id, scheduled_date, notes) VALUES (?, ?, ?, ?, ?)',
    [1, buyerId, dealerIds[0], nextWeek, 'Would like to test the manual variant']
  );
  console.log('[seed] Sample test-drive booking created');

  console.log('\n[seed] ✅ AutoBid database seeded successfully!');
  console.log('[seed] Demo accounts:');
  console.log('  buyer@demo.com  / buyer123  (role: buyer)');
  console.log('  dealer@demo.com / dealer123 (role: dealer)');
  console.log('  admin@demo.com  / admin123  (role: admin)');
}

/** Seeds only when the database is empty (used automatically on server start). */
async function ensureSeeded() {
  let count = 0, outdated = false;
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM users');
    count = Number(rows[0].n);
    // Databases created before per-variant specs existed lack these columns → rebuild them.
    try { await pool.query('SELECT fuel_type, power_bhp, features FROM variants LIMIT 1'); }
    catch (e) { outdated = true; }
  } catch (e) { count = 0; }   // tables do not exist yet
  if (count === 0 || outdated) {
    console.log(outdated
      ? '[seed] Database uses the old car/variant layout — rebuilding it with per-variant specs...'
      : '[seed] Database is empty — loading demo data...');
    await seed();
  }
}

module.exports = { seed, ensureSeeded };

if (require.main === module) {
  pool.init()
    .then(() => seed())
    .then(() => pool.close())
    .catch(err => {
      console.error('[seed] ❌ Seed failed:', err.message);
      console.error(err);
      process.exit(1);
    });
}
