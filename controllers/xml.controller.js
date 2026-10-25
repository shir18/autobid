/**
 * controllers/xml.controller.js — Experiment 8: XML catalog, formatter and validator.
 *
 *   GET  /api/xml/cars?mode=raw|css|xsl|html&type=&brand=&city=&limit=   → the car catalog as XML
 *   POST /api/xml/validate   { xml }                                      → well-formedness report
 *   POST /api/xml/format     { xml }                                      → auto-indented XML + report
 */
'use strict';
const pool = require('../db');
const { httpError } = require('../services/helpers');
const { buildCatalogXml, formatXml, validateXml, escapeXml, STYLE_MODES } = require('../services/xml');

const MAX_XML_CHARS = 500000;

async function catalogRows(q) {
  const where = ["c.status = 'available'"], params = [];
  if (q.type)  { where.push('c.type = ?');   params.push(q.type); }
  if (q.brand) { where.push('b.slug = ?');   params.push(q.brand); }
  if (q.city)  { where.push('c.city = ?');   params.push(q.city); }
  const limit = Math.min(500, Math.max(1, Number(q.limit) || 50));
  const [rows] = await pool.query(
    `SELECT c.id, c.type, c.status, c.year, c.city, c.listing_price,
            v.name AS variant_name, v.fuel_type, v.transmission,
            m.name AS model_name, m.body_type, b.name AS brand_name
       FROM cars c
       JOIN variants v ON v.id = c.variant_id
       JOIN models m   ON m.id = v.model_id
       JOIN brands b   ON b.id = m.brand_id
      WHERE ${where.join(' AND ')}
      ORDER BY c.listing_price ASC, c.id ASC
      LIMIT ?`, [...params, limit]);
  return rows;
}

/** Plain HTML table — fallback for browsers that no longer run XSLT (same data, no stylesheet). */
function htmlFallback(rows) {
  const tr = rows.map(c => `<tr><td>${escapeXml(c.brand_name)} ${escapeXml(c.model_name)}</td><td>${escapeXml(c.variant_name)}</td>` +
    `<td>${escapeXml(c.year)}</td><td>${escapeXml(c.fuel_type)}</td><td>${escapeXml(c.city)}</td>` +
    `<td>Rs. ${Number(c.listing_price).toLocaleString('en-IN')}</td></tr>`).join('');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AutoBid catalog</title>' +
    '<style>body{font-family:sans-serif;margin:24px}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px}th{background:#4F46E5;color:#fff}</style></head>' +
    `<body><h2>AutoBid catalog (${rows.length})</h2><table><tr><th>Car</th><th>Variant</th><th>Year</th><th>Fuel</th><th>City</th><th>Price</th></tr>${tr}</table></body></html>`;
}

async function cars(req, res, next) {
  try {
    const mode = String(req.query.mode || 'raw').toLowerCase();
    if (mode !== 'html' && !Object.prototype.hasOwnProperty.call(STYLE_MODES, mode)) {
      throw httpError(400, "mode must be one of: raw, css, xsl, html");
    }
    const rows = await catalogRows(req.query);
    if (mode === 'html') return res.type('html').send(htmlFallback(rows));
    const xml = buildCatalogXml(rows, { mode });
    if (req.query.download === '1') res.set('Content-Disposition', 'attachment; filename="autobid-catalog.xml"');
    res.type('application/xml; charset=utf-8').send(xml);
  } catch (err) { next(err); }
}

function readXml(req) {
  const xml = req.body && req.body.xml;
  if (typeof xml !== 'string' || !xml.trim()) throw httpError(400, 'Send JSON like { "xml": "<root/>" }');
  if (xml.length > MAX_XML_CHARS) throw httpError(413, 'XML is too large (500,000 characters max)');
  return xml;
}

function validate(req, res, next) {
  try { res.json(validateXml(readXml(req))); } catch (err) { next(err); }
}

function format(req, res, next) {
  try {
    const xml = readXml(req);
    const report = validateXml(xml);
    // Never "format" broken XML — the indent would hide the real problem.
    res.json({ ...report, formatted: report.valid ? formatXml(xml) : null });
  } catch (err) { next(err); }
}

module.exports = { cars, validate, format };
