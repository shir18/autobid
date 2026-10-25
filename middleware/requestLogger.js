/**
 * middleware/requestLogger.js
 * Express concept: custom middleware — logs method, URL, and timestamp for every API request
 * (static asset requests are skipped to keep the console readable).
 */
'use strict';
module.exports = function requestLogger(req, res, next) {
  if (req.originalUrl.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
};
