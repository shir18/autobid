'use strict';
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/requirements.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');

// GET /api/requirements?status=open&buyer_id=&city=   (login required)
// POST /api/requirements                              (buyers)
router.route('/')
  .get(authenticate, ctrl.list)
  .post(authenticate, requireRole('buyer'), requireFields('budget_min', 'budget_max', 'city'), ctrl.create);

router.route('/:id')
  .get(authenticate, ctrl.get)
  .patch(authenticate, requireRole('buyer', 'admin'), ctrl.close);

module.exports = router;
