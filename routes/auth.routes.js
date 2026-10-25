/**
 * routes/auth.routes.js
 * Express concept: router.route() chaining for POST on /register and /login.
 */
'use strict';
const express = require('express');
const router  = express.Router();
const auth    = require('../controllers/auth.controller');
const { requireFields } = require('../middleware/validate');
const { authenticate }  = require('../middleware/auth');

router.route('/register').post(requireFields('email', 'password', 'name'), auth.register);
router.route('/login').post(requireFields('email', 'password'), auth.login);
router.get('/me',    authenticate, auth.me);
router.get('/names', authenticate, auth.names);

module.exports = router;
