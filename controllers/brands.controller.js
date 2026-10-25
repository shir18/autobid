/**
 * controllers/brands.controller.js
 * CRUD for car brands.
 */
'use strict';
const pool = require('../db');

async function list(req, res, next) {
  try {
    // GROUP BY concept: return brand with model count
    const [rows] = await pool.query(`
      SELECT b.id, b.name, b.slug, b.logo_svg,
             COUNT(m.id) AS model_count
      FROM brands b
      LEFT JOIN models m ON m.brand_id = b.id
      GROUP BY b.id
      ORDER BY b.name ASC
    `);
    res.json(rows);
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM brands WHERE id = ?', [req.params.id]
    );
    if (!rows.length) { const e = new Error('Brand not found'); e.status = 404; throw e; }
    // Also return models for this brand
    const [models] = await pool.query(
      'SELECT * FROM models WHERE brand_id = ?', [rows[0].id]
    );
    res.json({ ...rows[0], models });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, slug, logo_svg } = req.body;
    const [result] = await pool.query(
      'INSERT INTO brands (name, slug, logo_svg) VALUES (?, ?, ?)',
      [name, slug, logo_svg || null]
    );
    res.status(201).json({ id: result.insertId, name, slug });
  } catch (err) { next(err); }
}

module.exports = { list, get, create };
