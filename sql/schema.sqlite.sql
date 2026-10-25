-- AutoBid schema for the embedded SQLite fallback (used when MySQL is not available).
-- Mirrors sql/schema.sql table-for-table.
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS shortlist;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS offers;
DROP TABLE IF EXISTS requirements;
DROP TABLE IF EXISTS cars;
DROP TABLE IF EXISTS variants;
DROP TABLE IF EXISTS models;
DROP TABLE IF EXISTS brands;
DROP TABLE IF EXISTS dealers;
DROP TABLE IF EXISTS users;
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','dealer','admin')),
  name          TEXT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brands (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  slug     TEXT NOT NULL UNIQUE,
  logo_svg TEXT
);

CREATE TABLE models (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id  INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL,
  body_type TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  seating   INTEGER NOT NULL DEFAULT 5
);

CREATE TABLE variants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id      INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price         REAL NOT NULL,
  transmission  TEXT NOT NULL DEFAULT 'Manual',
  mileage_kmpl  REAL,
  engine_cc     INTEGER,
  color_options TEXT,
  -- per-variant specs (change when the buyer picks a different variant of the same car)
  fuel_type           TEXT NOT NULL DEFAULT 'Petrol',
  power_bhp           REAL,
  torque_nm           REAL,
  boot_space_l        INTEGER,
  airbags             INTEGER,
  ncap_stars          INTEGER,
  ground_clearance_mm INTEGER,
  kerb_weight_kg      INTEGER,
  battery_kwh         REAL,
  range_km            INTEGER,
  features            TEXT
);

CREATE TABLE dealers (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  city     TEXT NOT NULL,
  address  TEXT,
  lat      REAL,
  lng      REAL,
  verified INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE cars (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id    INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'new' CHECK (type IN ('new','used')),
  year          INTEGER NOT NULL,
  km_driven     INTEGER NOT NULL DEFAULT 0,
  owner_count   INTEGER NOT NULL DEFAULT 0,
  city          TEXT NOT NULL,
  listing_price REAL NOT NULL,
  status        TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold','reserved')),
  dealer_id     INTEGER REFERENCES dealers(id) ON DELETE SET NULL,
  image_url     TEXT,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE requirements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_min    REAL NOT NULL,
  budget_max    REAL NOT NULL,
  body_type     TEXT,
  fuel          TEXT,
  city          TEXT NOT NULL,
  timeline_days INTEGER NOT NULL DEFAULT 30,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','awarded','closed')),
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE offers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  dealer_id      INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  price          REAL NOT NULL,
  delivery_days  INTEGER NOT NULL,
  freebies       TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (requirement_id, dealer_id)
);

CREATE TABLE orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id),
  offer_id       INTEGER NOT NULL REFERENCES offers(id),
  buyer_id       INTEGER NOT NULL REFERENCES users(id),
  dealer_id      INTEGER NOT NULL REFERENCES dealers(id),
  status         TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','delivered','cancelled')),
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id         INTEGER NOT NULL REFERENCES cars(id),
  user_id        INTEGER NOT NULL REFERENCES users(id),
  dealer_id      INTEGER NOT NULL REFERENCES dealers(id),
  scheduled_date DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  notes          TEXT
);

CREATE TABLE shortlist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  car_id     INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, car_id)
);
