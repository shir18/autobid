'use strict';
const express = require('express');
const router  = express.Router();
const offers  = require('../controllers/offers.controller');
const apiKey  = require('../middleware/requireApiKey');
const { authenticate, requireRole } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

// GET  /api/offers/counts  — GROUP BY status
router.get('/counts', offers.countsByStatus);

// GET  /api/offers/mine            — the logged-in dealer's offers
// GET  /api/offers/dealer/:dealerId (admin or the dealer themself)
router.get('/mine', authenticate, requireRole('dealer'), offers.listByDealer);
router.get('/dealer/:dealerId', authenticate, requireRole('dealer', 'admin'), offers.listByDealer);

// GET  /api/offers/requirement/:requirementId?sort=price   (the buyer who owns it)
router.get('/requirement/:requirementId', authenticate, offers.listByRequirement);

// POST /api/offers — dealer submits offer (JWT + api key)
router.route('/')
  .post(apiKey, authenticate, requireRole('dealer'),
        requireFields('requirement_id', 'price', 'delivery_days'), offers.create);

// PATCH /api/offers/:id/accept — ATOMIC TRANSACTION (buyer, JWT + api key)
router.patch('/:id/accept', apiKey, authenticate, requireRole('buyer', 'admin'), offers.acceptOffer);

// PATCH /api/offers/:id — dealer lowers/edits a pending bid
router.patch('/:id', apiKey, authenticate, requireRole('dealer'), offers.update);

module.exports = router;
