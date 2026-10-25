/**
 * routes/cars.routes.js
 * Express concepts: query strings, route params, router.route(), PATCH/DELETE.
 * NOTE: static paths (/compare, /variants, /shortlist…) are declared BEFORE /:id.
 */
'use strict';
const express = require('express');
const router  = express.Router();
const cars    = require('../controllers/cars.controller');
const apiKey  = require('../middleware/requireApiKey');
const { authenticate, requireRole } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

// GET /api/cars?brand=&fuel=&minPrice=&maxPrice=&sort=&page=&limit=&type=
// POST /api/cars (dealer/admin: JWT + api key)
router.route('/')
  .get(cars.list)
  .post(apiKey, authenticate, requireRole('dealer', 'admin'),
        requireFields('variant_id', 'year', 'city', 'listing_price'), cars.create);

router.get('/compare',  cars.compare);
router.get('/variants', cars.variants);

// Shortlist (login required)
router.post('/shortlist', authenticate, requireFields('user_id', 'car_id'), cars.addShortlist);
router.get('/shortlist/:userId', authenticate, cars.shortlist);
router.delete('/shortlist/:userId/:carId', authenticate, cars.removeShortlist);

router.get('/:id/fair-price', cars.fairPrice);

router.route('/:id')
  .get(cars.get)
  .patch(apiKey, authenticate, requireRole('dealer', 'admin'), cars.update)
  .delete(apiKey, authenticate, requireRole('dealer', 'admin'), cars.remove);

module.exports = router;
