'use strict';
const express = require('express');
const router  = express.Router();
const orders  = require('../controllers/orders.controller');
const { authenticate } = require('../middleware/auth');

router.get('/counts', authenticate, orders.countsByStatus);
router.get('/mine',   authenticate, orders.listMine);
router.patch('/:id/status', authenticate, orders.updateStatus);

module.exports = router;
