/**
 * services/xml.js — XML helpers for Experiment 8 ("Practicing with XML Formatters").
 *
 *   escapeXml()        – makes text safe for element content / attribute values
 *   buildCatalogXml()  – turns car rows into a well-formed <catalog> document
 *   formatXml()        – auto-indent ("XML formatter") a raw XML string
 *   validateXml()      – well-formedness check (the "XML validator" step); zero dependencies
 */
'use strict';

// Characters that are illegal in XML 1.0 (control chars except TAB, LF, CR)
const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

function escapeXml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(ILLEGAL, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** The three ways the same XML can be displayed in a browser. */
const STYLE_MODES = {
  raw: null,                                                        // browser shows the plain XML tree
  css: '<?xml-stylesheet type="text/css" href="/xml/cars.css"?>',   // styled with CSS
  xsl: '<?xml-stylesheet type="text/xsl" href="/xml/cars.xsl"?>'    // transformed to an HTML table with XSLT
};

/**
 * @param {Array}  cars  rows from the cars/variants/models/brands join
 * @param {Object} opts  { mode: 'raw'|'css'|'xsl', filters: {...} }
 */
function buildCatalogXml(cars, opts = {}) {
  const mode = Object.prototype.hasOwnProperty.call(STYLE_MODES, opts.mode) ? opts.mode : 'raw';
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  if (STYLE_MODES[mode]) lines.push(STYLE_MODES[mode]);

  lines.push(`<catalog generated="${new Date().toISOString()}" count="${cars.length}" currency="INR">`);
  for (const c of cars) {
    lines.push(`  <car id="${escapeXml(c.id)}" type="${escapeXml(c.type)}" status="${escapeXml(c.status)}">`);
    lines.push(`    <brand>${escapeXml(c.brand_name)}</brand>`);
    lines.push(`    <model>${escapeXml(c.model_name)}</model>`);
    lines.push(`    <variant>${escapeXml(c.variant_name)}</variant>`);
    lines.push(`    <year>${escapeXml(c.year)}</year>`);
    lines.push(`    <city>${escapeXml(c.city)}</city>`);
    lines.push(`    <bodyType>${escapeXml(c.body_type)}</bodyType>`);
    lines.push(`    <fuel>${escapeXml(c.fuel_type)}</fuel>`);
    lines.push(`    <transmission>${escapeXml(c.transmission)}</transmission>`);
    lines.push(`    <price>${Number(c.listing_price) || 0}</price>`);
    lines.push('  </car>');
  }
  lines.push('</catalog>');
  return lines.join('\n') + '\n';
}

// ── Tokenizer shared by the validator and the formatter ──────────────────────
// Order matters: comment / CDATA / PI / declaration / tag / text.
const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/?[^<>]*>|[^<]+|</g;
const NAME = '[A-Za-z_:][\\w:.\\-]*';
const ATTR_RE = new RegExp(`\\s+(${NAME})\\s*=\\s*("[^"<]*"|'[^'<]*')`, 'g');
const OPEN_RE = new RegExp(`^<(${NAME})((?:\\s+${NAME}\\s*=\\s*(?:"[^"<]*"|'[^'<]*'))*)\\s*(/?)>$`);
const CLOSE_RE = new RegExp(`^</(${NAME})\\s*>$`);
const BAD_ENTITY = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+);)/;

function lineOf(src, index) { return src.slice(0, index).split('\n').length; }

/**
 * Well-formedness check: single root, matching/nested tags, quoted unique attributes,
 * legal entities, a proper XML declaration. Returns { valid, errors[], root, elements }.
 */
function validateXml(xml) {
  const errors = [];
  const src = String(xml || '');
  if (!src.trim()) return { valid: false, errors: [{ line: 1, message: 'Document is empty' }], root: null, elements: 0 };

  const fail = (index, message) => errors.push({ line: lineOf(src, index), message });
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(src)) fail(0, 'Document contains illegal control characters');

  const text = src.replace(/^\uFEFF/, '');
  if (/^\s+<\?xml/.test(text)) fail(0, 'XML declaration must be at the very start of the document');

  const stack = [];
  let root = null, rootCount = 0, elements = 0, m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    const tok = m[0], at = m.index;
    if (tok === '<') { fail(at, "Stray '<' – use &lt; for a literal less-than sign"); continue; }
    if (tok.startsWith('<!--')) {
      if (tok.slice(4, -3).includes('--')) fail(at, "'--' is not allowed inside a comment");
      continue;
    }
    if (tok.startsWith('<![CDATA[')) { if (!stack.length) fail(at, 'CDATA outside the root element'); continue; }
    if (tok.startsWith('<?')) {
      if (/^<\?xml[\s?]/i.test(tok) && at !== 0 && !(at === 1 && text.charCodeAt(0) === 0xFEFF)) fail(at, 'XML declaration must come first');
      continue;
    }
    if (tok.startsWith('<!DOCTYPE')) continue;
    if (tok.startsWith('</')) {
      const c = CLOSE_RE.exec(tok);
      if (!c) { fail(at, `Malformed closing tag ${tok}`); continue; }
      const top = stack.pop();
      if (!top) fail(at, `Closing tag </${c[1]}> has no matching opening tag`);
      else if (top !== c[1]) fail(at, `Mismatched tag: expected </${top}> but found </${c[1]}>`);
      continue;
    }
    if (tok.startsWith('<')) {
      const o = OPEN_RE.exec(tok);
      if (!o) { fail(at, `Malformed tag ${tok.length > 40 ? tok.slice(0, 40) + '…' : tok} (attribute values must be quoted)`); continue; }
      elements++;
      if (!stack.length) { rootCount++; if (!root) root = o[1]; if (rootCount > 1) fail(at, 'Only one root element is allowed'); }
      const seen = new Set(); let a;
      ATTR_RE.lastIndex = 0;
      while ((a = ATTR_RE.exec(o[2])) !== null) {
        if (seen.has(a[1])) fail(at, `Duplicate attribute '${a[1]}' on <${o[1]}>`);
        seen.add(a[1]);
        if (BAD_ENTITY.test(a[2])) fail(at, `Unescaped '&' in attribute '${a[1]}'`);
      }
      if (!o[3]) stack.push(o[1]);
      continue;
    }
    // character data
    if (BAD_ENTITY.test(tok)) fail(at, "Unescaped '&' – use &amp;");
    if (tok.includes(']]>')) fail(at, "']]>' is not allowed in text");
    if (!stack.length && tok.trim()) fail(at, 'Text found outside the root element');
  }
  if (stack.length) errors.push({ line: lineOf(src, src.length), message: `Unclosed element <${stack[stack.length - 1]}>` });
  if (!root && !errors.length) errors.push({ line: 1, message: 'No root element found' });

  return { valid: errors.length === 0, errors: errors.slice(0, 20), root, elements };
}

/**
 * Auto-indent. Elements that only contain text stay on one line:
 *   <title>Web Technologies</title>
 * Throws nothing — call validateXml() first if you need to know the input is sound.
 */
function formatXml(xml, indent = '  ') {
  const tokens = String(xml).match(TOKEN) || [];
  const out = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const pad = indent.repeat(Math.max(depth, 0));
    if (!t.startsWith('<')) {                         // text between tags
      if (t.trim()) out.push(pad + t.trim());
      continue;
    }
    if (t.startsWith('</')) {                         // closing tag
      depth--;
      out.push(indent.repeat(Math.max(depth, 0)) + t);
      continue;
    }
    const selfOrSpecial = /\/>$/.test(t) || /^<[?!]/.test(t);
    if (selfOrSpecial) { out.push(pad + t); continue; }
    // <a>text</a>  → keep on one line
    const next = tokens[i + 1], after = tokens[i + 2];
    if (next && !next.startsWith('<') && after && after.startsWith('</')) {
      out.push(pad + t + next.trim() + after);
      i += 2;
      continue;
    }
    out.push(pad + t);
    depth++;
  }
  return out.join('\n') + '\n';
}

module.exports = { escapeXml, buildCatalogXml, formatXml, validateXml, STYLE_MODES };
