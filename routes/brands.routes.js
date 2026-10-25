/**
 * routes/brands.routes.js
 * Express concepts: router.route() chaining, route params (:id).
 */
'use strict';
const express  = require('express');
const router   = express.Router();
const brands   = require('../controllers/brands.controller');
const apiKey   = require('../middleware/requireApiKey');
const { authenticate, requireRole } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

// GET /api/brands  POST /api/brands (admin only: JWT + api key)
router.route('/')
  .get(brands.list)
  .post(apiKey, authenticate, requireRole('admin'), requireFields('name', 'slug'), brands.create);

// GET /api/brands/:id
router.route('/:id').get(brands.get);

module.exports = router;
