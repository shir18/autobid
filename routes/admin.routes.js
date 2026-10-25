/**
 * routes/admin.routes.js — admin dashboard data (JWT, role = admin).
 */
'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('admin'));

// GET /api/admin/stats — totals and GROUP BY status breakdowns
router.get('/stats', async (req, res, next) => {
  try {
    const one = async sql => (await pool.query(sql))[0];
    const [users, cars, dealers, brands] = await Promise.all([
      one('SELECT role, COUNT(*) AS count FROM users GROUP BY role'),
      one('SELECT type, status, COUNT(*) AS count FROM cars GROUP BY type, status'),
      one('SELECT COUNT(*) AS count FROM dealers'),
      one('SELECT COUNT(*) AS count FROM brands')
    ]);
    const [requirements, offers, orders, bookings] = await Promise.all([
      one('SELECT status, COUNT(*) AS count FROM requirements GROUP BY status'),
      one('SELECT status, COUNT(*) AS count FROM offers GROUP BY status'),
      one('SELECT status, COUNT(*) AS count FROM orders GROUP BY status'),
      one('SELECT status, COUNT(*) AS count FROM bookings GROUP BY status')
    ]);
    res.json({ users, cars, dealers: dealers[0].count, brands: brands[0].count, requirements, offers, orders, bookings });
  } catch (err) { next(err); }
});

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY id DESC LIMIT 200');
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
