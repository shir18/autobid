/**
 * middleware/requireApiKey.js
 * Express concept: gating middleware — checks the x-api-key header.
 * Default key is "demo-key" so no configuration is needed.
 * Used on admin and dealer write routes (in addition to JWT auth).
 */
'use strict';
const { API_KEY } = require('../config');

module.exports = function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    const err = new Error('Missing or invalid API key');
    err.status = 401;
    return next(err);
  }
  next();
};
