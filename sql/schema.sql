-- AutoBid MySQL Schema
-- Run: mysql -u root autobid < sql/schema.sql

SET FOREIGN_KEY_CHECKS = 0;

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

SET FOREIGN_KEY_CHECKS = 1;

-- Users (buyers, dealers, admins)
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('buyer','dealer','admin') NOT NULL DEFAULT 'buyer',
  name          VARCHAR(100) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Car brands
CREATE TABLE brands (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(100) NOT NULL,
  slug     VARCHAR(100) NOT NULL UNIQUE,
  logo_svg TEXT
);

-- Car models (belongs to brand)
CREATE TABLE models (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  brand_id  INT NOT NULL,
  name      VARCHAR(100) NOT NULL,
  slug      VARCHAR(100) NOT NULL,
  body_type ENUM('Sedan','SUV','Hatchback','MUV','Coupe','Convertible','Pickup','Van') NOT NULL,
  fuel_type SET('Petrol','Diesel','Electric','Hybrid','CNG') NOT NULL,
  seating   INT NOT NULL DEFAULT 5,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

-- Variants of a model (price, engine, transmission)
CREATE TABLE variants (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  model_id        INT NOT NULL,
  name            VARCHAR(150) NOT NULL,
  price           DECIMAL(12,2) NOT NULL,
  transmission    ENUM('Manual','Automatic','CVT','DCT') NOT NULL DEFAULT 'Manual',
  mileage_kmpl    DECIMAL(5,2),
  engine_cc       INT,
  color_options   JSON,
  -- per-variant specs (change when the buyer picks a different variant of the same car)
  fuel_type           VARCHAR(20) NOT NULL DEFAULT 'Petrol',
  power_bhp           DECIMAL(6,1),
  torque_nm           DECIMAL(6,1),
  boot_space_l        INT,
  airbags             INT,
  ncap_stars          INT,
  ground_clearance_mm INT,
  kerb_weight_kg      INT,
  battery_kwh         DECIMAL(5,1),
  range_km            INT,
  features            TEXT,
  FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- Dealers
CREATE TABLE dealers (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  user_id   INT NOT NULL UNIQUE,
  name      VARCHAR(150) NOT NULL,
  city      VARCHAR(100) NOT NULL,
  address   VARCHAR(255),
  lat       DECIMAL(10,7),
  lng       DECIMAL(10,7),
  verified  TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Car listings (new and used)
CREATE TABLE cars (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  variant_id     INT NOT NULL,
  type           ENUM('new','used') NOT NULL DEFAULT 'new',
  year           INT NOT NULL,
  km_driven      INT NOT NULL DEFAULT 0,
  owner_count    INT NOT NULL DEFAULT 0,
  city           VARCHAR(100) NOT NULL,
  listing_price  DECIMAL(12,2) NOT NULL,
  status         ENUM('available','sold','reserved') NOT NULL DEFAULT 'available',
  dealer_id      INT,
  image_url      TEXT,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE CASCADE,
  FOREIGN KEY (dealer_id) REFERENCES dealers(id) ON DELETE SET NULL
);

-- Buyer requirements (reverse bidding)
CREATE TABLE requirements (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  buyer_id     INT NOT NULL,
  budget_min   DECIMAL(12,2) NOT NULL,
  budget_max   DECIMAL(12,2) NOT NULL,
  body_type    VARCHAR(50),
  fuel         VARCHAR(50),
  city         VARCHAR(100) NOT NULL,
  timeline_days INT NOT NULL DEFAULT 30,
  status       ENUM('open','awarded','closed') NOT NULL DEFAULT 'open',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Dealer offers on requirements (reverse bidding)
CREATE TABLE offers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  requirement_id  INT NOT NULL,
  dealer_id       INT NOT NULL,
  price           DECIMAL(12,2) NOT NULL,
  delivery_days   INT NOT NULL,
  freebies        TEXT,
  status          ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_offer (requirement_id, dealer_id),
  FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE,
  FOREIGN KEY (dealer_id) REFERENCES dealers(id) ON DELETE CASCADE
);

-- Orders (created when offer accepted)
CREATE TABLE orders (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  requirement_id  INT NOT NULL,
  offer_id        INT NOT NULL,
  buyer_id        INT NOT NULL,
  dealer_id       INT NOT NULL,
  status          ENUM('confirmed','delivered','cancelled') NOT NULL DEFAULT 'confirmed',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requirement_id) REFERENCES requirements(id),
  FOREIGN KEY (offer_id) REFERENCES offers(id),
  FOREIGN KEY (buyer_id) REFERENCES users(id),
  FOREIGN KEY (dealer_id) REFERENCES dealers(id)
);

-- Test drive bookings
CREATE TABLE bookings (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  car_id         INT NOT NULL,
  user_id        INT NOT NULL,
  dealer_id      INT NOT NULL,
  scheduled_date DATE NOT NULL,
  status         ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  notes          TEXT,
  FOREIGN KEY (car_id) REFERENCES cars(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (dealer_id) REFERENCES dealers(id)
);

-- User shortlist
CREATE TABLE shortlist (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  car_id     INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_shortlist (user_id, car_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);
