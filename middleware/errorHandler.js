/**
 * middleware/errorHandler.js
 * Express concept: 4-argument error handler — MUST be registered last.
 * Catches all errors forwarded via next(err) and turns database errors into
 * friendly 4xx responses instead of a bare 500.
 */
'use strict';
/* eslint-disable no-unused-vars */
module.exports = function errorHandler(err, req, res, next) {
  let status  = err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Friendly messages for common SQL constraint failures (MySQL + SQLite)
  const raw = String(err.code || '') + ' ' + String(err.message || '');
  if (/ER_DUP_ENTRY|UNIQUE constraint failed/i.test(raw)) { status = 409; message = 'That already exists'; }
  else if (/ER_NO_REFERENCED_ROW|FOREIGN KEY constraint failed/i.test(raw)) { status = 400; message = 'Referenced record does not exist'; }
  else if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON body'; }

  if (status >= 500) console.error(`[error] ${status} ${message}`, err.stack || '');
  else console.warn(`[error] ${status} ${message}`);
  res.status(status).json({ error: message, status });
};
