/**
 * routes/xml.routes.js — Experiment 8 (XML formatters). All public, read-only / stateless.
 */
'use strict';
const express = require('express');
const router  = express.Router();
const xml     = require('../controllers/xml.controller');

router.get('/cars', xml.cars);
router.post('/validate', xml.validate);
router.post('/format', xml.format);

module.exports = router;
