/**
 * middleware/auth.js — JWT authentication + role guards.
 *
 *   authenticate      : token required (401 otherwise) — sets req.user = { id, role }
 *   optionalAuth      : sets req.user when a valid token is present, never fails
 *   requireRole(...)  : 403 unless req.user.role is one of the given roles
 */
'use strict';
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function readToken(req) {
  const header = req.headers['authorization'] || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function authenticate(req, res, next) {
  const token = readToken(req);
  if (!token) { const e = new Error('Please log in first'); e.status = 401; return next(e); }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    const e = new Error('Session expired — please log in again'); e.status = 401; next(e);
  }
}

function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) { try { req.user = jwt.verify(token, JWT_SECRET); } catch (e) { /* ignore */ } }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const e = new Error('Your account type is not allowed to do this'); e.status = 403; return next(e);
    }
    next();
  };
}

module.exports = { authenticate, optionalAuth, requireRole };
