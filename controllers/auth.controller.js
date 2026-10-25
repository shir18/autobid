/**
 * controllers/auth.controller.js
 * Registration + login. Passwords hashed with bcryptjs, sessions are JWTs.
 * Registering as a *dealer* also creates the dealership record (dealers table)
 * so the dealer dashboard works immediately.
 */
'use strict';
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../db');
const { JWT_SECRET } = require('../config');
const { httpError, getDealerByUser } = require('../services/helpers');
const { authenticate } = require('../middleware/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(u) { return { id: u.id, email: u.email, name: u.name, role: u.role }; }
function sign(u) { return jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '7d' }); }

async function register(req, res, next) {
  try {
    const { password, name, role = 'buyer', city, dealership, address } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!['buyer', 'dealer'].includes(role)) throw httpError(400, 'Role must be buyer or dealer');
    if (!EMAIL_RE.test(email))               throw httpError(400, 'Please enter a valid email address');
    if (String(password).length < 6)         throw httpError(400, 'Password must be at least 6 characters');
    if (!String(name).trim())                throw httpError(400, 'Name is required');

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) throw httpError(409, 'Email already registered');

    const hash = await bcrypt.hash(String(password), 10);
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, hash, String(name).trim(), role]
    );
    const user = { id: result.insertId, email, name: String(name).trim(), role };

    let dealer = null;
    if (role === 'dealer') {
      const dealerName = String(dealership || '').trim() || (user.name + ' Motors');
      const [dr] = await pool.query(
        'INSERT INTO dealers (user_id, name, city, address) VALUES (?, ?, ?, ?)',
        [user.id, dealerName, city || 'Mumbai', address || null]
      );
      dealer = { id: dr.insertId, name: dealerName, city: city || 'Mumbai' };
    }
    res.status(201).json({ token: sign(user), user, dealer });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) throw httpError(401, 'Invalid email or password');
    const user = rows[0];
    const match = await bcrypt.compare(String(req.body.password), user.password_hash);
    if (!match) throw httpError(401, 'Invalid email or password');
    const dealer = user.role === 'dealer' ? await getDealerByUser(user.id) : null;
    res.json({ token: sign(user), user: publicUser(user), dealer });
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT id, email, name, role FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) throw httpError(401, 'Account no longer exists');
    const dealer = rows[0].role === 'dealer' ? await getDealerByUser(rows[0].id) : null;
    res.json({ user: rows[0], dealer });
  } catch (err) { next(err); }
}

/** GET /api/auth/names?ids=1,2,3 → [{id,name,role}] (used by chat to label participants) */
async function names(req, res, next) {
  try {
    const ids = String(req.query.ids || '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 50);
    if (!ids.length) return res.json([]);
    const [rows] = await pool.query(
      `SELECT id, name, role FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ids
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { register, login, me, names, authenticate };
