/**
 * routes/dealers.routes.js
 * NOTE: fixed paths (/me, /bookings…) are declared BEFORE /:id so they are not swallowed by it.
 */
'use strict';
const express  = require('express');
const router   = express.Router();
const dealers  = require('../controllers/dealers.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

router.get('/', dealers.list);

router.get('/me',          authenticate, requireRole('dealer'), dealers.me);
router.get('/me/bookings', authenticate, requireRole('dealer'), dealers.dealerBookings);

// Book test drive (buyers)
router.post('/bookings', authenticate, requireFields('car_id', 'scheduled_date'), dealers.book);
router.get('/bookings/user/:userId', authenticate, dealers.listBookings);
router.patch('/bookings/:id', authenticate, dealers.updateBooking);

router.get('/:id', dealers.get);

module.exports = router;
