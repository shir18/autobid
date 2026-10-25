# Experiment 8 — Practicing with XML Formatters (AutoBid)

**Aim:** create a well-formed XML document and transform/format it for display using CSS and XSLT.
**Applied to AutoBid:** the XML document is the **live car catalog** (new + used listings from the database).

## Mapping: experiment step → AutoBid

| # | Lab procedure step | Done in AutoBid by | Where to see it |
|---|---|---|---|
| 1 | Create a well-formed XML file (brand / model / city / price) | Sample: `public/xml/catalog.xml`. Cars: `buildCatalogXml()` in `services/xml.js` (brand / model / variant / price …, all values escaped) | `/xml/catalog.xml`, `/api/xml/cars?mode=raw` |
| 2 | Validate it is well-formed and auto-indent it | `validateXml()` + `formatXml()` → `POST /api/xml/validate`, `POST /api/xml/format` | XML Lab → *Formatter & validator* |
| 3 | Attach CSS with `<?xml-stylesheet?>` and style each element | `public/xml/catalog.css`, `public/xml/cars.css`; PI `type="text/css"` | `/xml/catalog.xml`, `/api/xml/cars?mode=css` |
| 4 | Open the XML directly in a browser, observe CSS rendering | Browser renders the XML URL itself (card-style list) | XML Lab → *2 · CSS styled* (iframe) |
| 5 | Repeat with XSLT → HTML table | `public/xml/catalog.xsl`, `public/xml/cars.xsl`; PI `type="text/xsl"` | `/xml/catalog-xslt.xml`, `/api/xml/cars?mode=xsl` |

> Screenshot-by-screenshot walkthrough: see [`EXPERIMENT_8_OUTPUT_GUIDE.md`](EXPERIMENT_8_OUTPUT_GUIDE.md).

## How to run the experiment (step by step)

1. `npm install && npm start` → open http://localhost:3000 (demo data loads automatically).
2. **Create XML:** open `http://localhost:3000/xml/catalog.xml` (lab file) and `http://localhost:3000/api/xml/cars?mode=raw` (car catalog).
3. **Validate + format:** go to **XML Lab** in the navbar → *Formatter & validator*. Click **Validate & format**: you get a green "Well-formed" box and an indented copy. Click **Break it** (mismatched tag + raw `&`) → red errors with line numbers, and no formatted output.
4. **CSS:** `…/xml/catalog.xml` and `…/api/xml/cars?mode=css` — same data, each element styled via the `display` rules.
5. **XSLT:** `…/xml/catalog-xslt.xml` and `…/api/xml/cars?mode=xsl` — the stylesheet reference is switched to `.xsl`; result is an HTML table (sorted cheapest first, with a total).
6. Run the tests: `npm run test:xml`.

Only one line differs between the CSS and XSLT views of a document:

```xml
<?xml-stylesheet type="text/css" href="/xml/cars.css"?>   <!-- step 3/4 -->
<?xml-stylesheet type="text/xsl" href="/xml/cars.xsl"?>   <!-- step 5   -->
```

## Improvements over the lab sheet

* **`catalog.xsl` fixed.** The sheet's XSLT outputs a bare `<table>`; browsers then treat the result as XML and may show unstyled text. The AutoBid version adds `<xsl:output method="html"/>` and an `<html>` wrapper.
* XSLT additions: `xsl:sort` (cheapest first), `position()` row numbers, `format-number`, `sum()` total, conditional class for used cars.
* CSS additions: `[type="used"]` attribute selector, `::before` labels, pill badges.
* **Escaping:** `&`, `<`, `>`, quotes and illegal control characters in car data can never break the document.
* **Formatter refuses broken XML** — it validates first, because indenting invalid XML hides the real error.
* **HTML fallback** (`?mode=html`): Chrome has announced it is removing XSLT support, so a server-built table with the same columns is provided in case your browser no longer runs XSLT. CSS-styled XML is unaffected.
* Filters: `?type=new|used`, `?brand=<slug>`, `?city=`, `?limit=`; `?download=1` saves `autobid-catalog.xml`.

## Files added / changed

| File | Purpose |
|---|---|
| `services/xml.js` | escape, build, format, validate (no dependencies) |
| `controllers/xml.controller.js`, `routes/xml.routes.js` | `/api/xml/*` endpoints |
| `public/xml/*` | `catalog.xml`, `catalog-xslt.xml`, `catalog.css`, `catalog.xsl`, `cars.css`, `cars.xsl` |
| `public/templates/xmllab.html`, `public/controllers/xmllab.controller.js` | XML Lab page |
| `tests/xml.test.js` | 10 unit + end-to-end tests |
| `server.js`, `public/app.js`, `public/index.html`, `public/css/styles.css`, `package.json` | wiring (route, nav link, styles, `test` / `test:xml` scripts) |

## Result
An XML document (sample car catalog and the live AutoBid catalog) was created, validated, formatted and rendered using both CSS and XSLT stylesheets.
