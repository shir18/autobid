/**
 * tests/xml.test.js — Experiment 8 (XML formatters): unit tests for services/xml.js
 * plus end-to-end tests for /api/xml/* and the static CSS/XSLT files.   Run: npm run test:xml
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'autobid-xml-'));
process.env.DB_ENGINE     = process.env.DB_ENGINE || 'sqlite';
process.env.SQLITE_FILE   = path.join(tmp, 'test.sqlite');
process.env.FALLBACK_FILE = path.join(tmp, 'fallback.json');
process.env.MONGO_URI     = 'mongodb://127.0.0.1:1/none';
if (process.env.DB_ENGINE === 'mysql') process.env.MYSQL_DB = 'autobid_test';

const { escapeXml, buildCatalogXml, formatXml, validateXml } = require('../services/xml');
const { start } = require('../server');

// ── unit ─────────────────────────────────────────────────────────────────────
test('escapeXml escapes the five special characters and strips control chars', () => {
  assert.equal(escapeXml(`Tom & "Jerry" <b>'x'</b>`), 'Tom &amp; &quot;Jerry&quot; &lt;b&gt;&apos;x&apos;&lt;/b&gt;');
  assert.equal(escapeXml('a\u0001b'), 'ab');
  assert.equal(escapeXml(null), '');
});

test('validateXml accepts the lab catalog.xml', () => {
  const xml = fs.readFileSync(path.join(__dirname, '../public/xml/catalog.xml'), 'utf8');
  const r = validateXml(xml);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  assert.equal(r.root, 'catalog');
  assert.equal(r.elements, 16);  // catalog + 3 × (car, brand, model, city, price)
});

test('validateXml reports each class of well-formedness error', () => {
  const bad = {
    'mismatched tag':    '<a><b></a></b>',
    'unclosed element':  '<a><b></b>',
    'two roots':         '<a/><b/>',
    'unquoted attr':     '<a x=1/>',
    'duplicate attr':    '<a x="1" x="2"/>',
    'raw ampersand':     '<a>Tom & Jerry</a>',
    'text outside root': '<a/>junk',
    'stray <':           '<a>1 < 2</a>',
    'empty':             '   ',
    'late declaration':  '\n<?xml version="1.0"?><a/>'
  };
  for (const [name, xml] of Object.entries(bad)) {
    const r = validateXml(xml);
    assert.equal(r.valid, false, name + ' should be invalid');
    assert.ok(r.errors.length && r.errors[0].line >= 1, name + ' should give a line number');
  }
});

test('validateXml accepts comments, CDATA, entities, self-closing tags and namespaces', () => {
  const ok = '<?xml version="1.0"?>\n<!-- hi -->\n<x:a xmlns:x="u" n=\'1\'><b/><![CDATA[ 1 < 2 & 3 ]]><c>&amp; &#169; &#xA9;</c></x:a>';
  assert.equal(validateXml(ok).valid, true, JSON.stringify(validateXml(ok).errors));
});

test('formatXml indents, keeps text-only elements on one line, and stays well-formed', () => {
  const out = formatXml('<?xml version="1.0"?><catalog><car><brand>Web</brand><model>G</model></car></catalog>');
  assert.equal(out, '<?xml version="1.0"?>\n<catalog>\n  <car>\n    <brand>Web</brand>\n    <model>G</model>\n  </car>\n</catalog>\n');
  assert.equal(validateXml(out).valid, true);
  assert.equal(formatXml(out), out, 'formatting is idempotent');
});

test('buildCatalogXml escapes data and picks the right stylesheet line', () => {
  const row = { id: 1, type: 'new', status: 'available', brand_name: 'A & B', model_name: '<M>', variant_name: 'V"1', year: 2025, city: 'X', body_type: 'SUV', fuel_type: 'Petrol', transmission: 'Manual', listing_price: 500000 };
  for (const mode of ['raw', 'css', 'xsl']) {
    const xml = buildCatalogXml([row], { mode });
    assert.equal(validateXml(xml).valid, true, mode);
    assert.ok(xml.includes('A &amp; B') && xml.includes('&lt;M&gt;'));
    assert.equal(/<\?xml-stylesheet/.test(xml), mode !== 'raw');
  }
  assert.ok(buildCatalogXml([row], { mode: 'css' }).includes('type="text/css" href="/xml/cars.css"'));
  assert.ok(buildCatalogXml([row], { mode: 'xsl' }).includes('type="text/xsl" href="/xml/cars.xsl"'));
});

// ── end to end ───────────────────────────────────────────────────────────────
let server, base;
test.before(async () => { server = await start(0); base = 'http://127.0.0.1:' + server.address().port; });
test.after(() => new Promise(r => server.close(r)));

const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('GET /api/xml/cars returns well-formed XML in every mode', async () => {
  for (const mode of ['raw', 'css', 'xsl']) {
    const res = await fetch(`${base}/api/xml/cars?mode=${mode}&limit=8`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/xml/);
    const xml = await res.text();
    const r = validateXml(xml);
    assert.equal(r.valid, true, mode + ': ' + JSON.stringify(r.errors));
    assert.equal(r.root, 'catalog');
    assert.equal((xml.match(/<car /g) || []).length, 8);
    assert.equal(/<\?xml-stylesheet/.test(xml), mode !== 'raw');
  }
});

test('GET /api/xml/cars filters by type and rejects bad input', async () => {
  const used = await (await fetch(`${base}/api/xml/cars?type=used&limit=500`)).text();
  assert.ok(used.includes('<car ') && !used.includes('type="new"'));
  assert.equal((await fetch(`${base}/api/xml/cars?mode=bogus`)).status, 400);
  const html = await fetch(`${base}/api/xml/cars?mode=html&limit=3`);
  assert.match(html.headers.get('content-type'), /text\/html/);
  assert.match(await html.text(), /<table>/);
  const dl = await fetch(`${base}/api/xml/cars?download=1&limit=2`);
  assert.match(dl.headers.get('content-disposition'), /attachment/);
});

test('POST /api/xml/validate and /format', async () => {
  let r = await (await post('/api/xml/validate', { xml: '<a><b>1</b></a>' })).json();
  assert.equal(r.valid, true);

  r = await (await post('/api/xml/validate', { xml: '<a><b>1</a>' })).json();
  assert.equal(r.valid, false);
  assert.match(r.errors[0].message, /Mismatched/);

  r = await (await post('/api/xml/format', { xml: '<a><b>1</b></a>' })).json();
  assert.equal(r.formatted, '<a>\n  <b>1</b>\n</a>\n');

  r = await (await post('/api/xml/format', { xml: '<a><b>1</a>' })).json();
  assert.equal(r.valid, false);
  assert.equal(r.formatted, null, 'broken XML is never "formatted"');

  assert.equal((await post('/api/xml/validate', {})).status, 400);
  assert.equal((await post('/api/xml/validate', { xml: 'x'.repeat(500001) })).status, 413);
});

test('static lab files are served with the right MIME types', async () => {
  const css = await fetch(`${base}/xml/cars.css`);
  assert.match(css.headers.get('content-type'), /text\/css/);
  const xsl = await fetch(`${base}/xml/cars.xsl`);
  assert.equal(xsl.status, 200);
  assert.match(xsl.headers.get('content-type'), /xml|xslt/);
  for (const f of ['catalog.xml', 'catalog-xslt.xml', 'catalog.css', 'catalog.xsl']) {
    assert.equal((await fetch(`${base}/xml/${f}`)).status, 200, f);
  }
});
