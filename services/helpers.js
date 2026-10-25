/**
 * services/helpers.js — small shared helpers for controllers.
 */
'use strict';
const pool = require('../db');

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/** Returns the dealers row that belongs to a user id (or null). */
async function getDealerByUser(userId) {
  const [rows] = await pool.query('SELECT * FROM dealers WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

/** Same as above but throws 403 when the user has no dealership. */
async function requireDealer(userId) {
  const d = await getDealerByUser(userId);
  if (!d) throw httpError(403, 'No dealership is linked to this account');
  return d;
}

/** Normalises anything date-like to YYYY-MM-DD (or null when invalid). */
function toDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function positiveNumber(v, label) {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) throw httpError(400, label + ' must be a positive number');
  return n;
}

module.exports = { httpError, getDealerByUser, requireDealer, toDateOnly, positiveNumber };
