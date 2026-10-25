'use strict';
const express = require('express');
const router  = express.Router();
const mlc     = require('../controllers/ml.controller');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/info', mlc.info);
router.post('/recommend', mlc.recommend);
router.get('/similar/:carId', mlc.similar);
router.get('/used-price', authenticate, requireRole('dealer', 'admin'), mlc.usedPrice);
router.get('/bid-suggestion/:reqId', authenticate, requireRole('dealer', 'admin'), mlc.bidSuggestion);

module.exports = router;
