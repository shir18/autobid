/**
 * middleware/validate.js
 * Express concept: body validation — throws errors with err.status so the
 * central errorHandler can return proper JSON error responses.
 */
'use strict';

/**
 * Validates that required fields are present and non-empty in req.body.
 * Forwards a 400 error via next(err) if any field is missing.
 */
function requireFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => {
      const v = req.body[f];
      return v === undefined || v === null || v === '';
    });
    if (missing.length > 0) {
      const err = new Error(`Missing required fields: ${missing.join(', ')}`);
      err.status = 400;
      return next(err);
    }
    next();
  };
}

/**
 * Validates that a field value is one of the allowed enum values.
 */
function requireEnum(field, allowed) {
  return (req, res, next) => {
    const val = req.body[field];
    if (val !== undefined && !allowed.includes(val)) {
      const err = new Error(`Invalid value '${val}' for '${field}'. Allowed: ${allowed.join(', ')}`);
      err.status = 400;
      return next(err);
    }
    next();
  };
}

module.exports = { requireFields, requireEnum };
