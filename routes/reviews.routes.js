'use strict';
const express = require('express');
const router  = express.Router();
const reviews = require('../controllers/reviews.controller');
const { authenticate } = require('../middleware/auth');

router.route('/car/:carId')
  .get(reviews.list)
  .post(authenticate, reviews.create);

module.exports = router;
