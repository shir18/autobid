/**
 * routes/activity.routes.js
 * Activity feed (MongoDB or file fallback). Events are created server-side
 * (new offers, accepted/rejected offers, bookings, chat messages) — there is no public POST.
 */
'use strict';
const express = require('express');
const router  = express.Router();
const { activity } = require('../services/store');
const { authenticate } = require('../middleware/auth');

// GET /api/activity/mine — my recent feed
router.get('/mine', authenticate, async (req, res, next) => {
  try { res.json(await activity.list(req.user.id, 50)); } catch (err) { next(err); }
});

// GET /api/activity/:userId — same feed, only for yourself (kept for compatibility)
router.get('/:userId', authenticate, async (req, res, next) => {
  try {
    if (String(req.params.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      const e = new Error('You can only view your own activity'); e.status = 403; throw e;
    }
    res.json(await activity.list(req.params.userId, 50));
  } catch (err) { next(err); }
});

module.exports = router;
