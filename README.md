# AutoBid 🚗

A CarWale-style car marketplace with **reverse bidding** — buyers post what they want, dealers compete with offers, and accepting one offer atomically rejects all the others and creates an order.

## Run it (2 commands)

```bash
npm install
npm start          # → http://localhost:3000
```

On first start the app **creates the database and loads demo data automatically**. (`npm run seed` resets the demo data any time.)

* **Database:** uses **MySQL** if one is running (`root`, empty password, DB `autobid` — created for you).
  If MySQL is *not* available it falls back to an **embedded SQLite file** (`data/autobid.sqlite`) — nothing to install.
  Force one with `DB_ENGINE=mysql` or `DB_ENGINE=sqlite`.
* **MongoDB** is optional. Without it, chat / reviews / activity feed use a persistent JSON file (`data/fallback.json`).
* AngularJS is bundled in `public/vendor` — no internet/CDN needed.

Optional env vars: `PORT`, `DB_ENGINE`, `MYSQL_HOST/PORT/USER/PASSWORD/DB`, `MONGO_URI`, `API_KEY`, `JWT_SECRET`.
`docker-compose up -d` starts MySQL + MongoDB if you want the full stack.

## Demo accounts

| Role   | Email            | Password  |
|--------|------------------|-----------|
| Buyer  | buyer@demo.com   | buyer123  |
| Dealer | dealer@demo.com  | dealer123 |
| Admin  | admin@demo.com   | admin123  |

You can also register new buyers/dealers (a dealer signup creates the dealership automatically).

## Try the reverse-bidding flow

1. **Buyer** → Dashboard → *Post Requirement*.
2. **Dealer** → *Open Requirements* → submit an offer (lower it later = "bidding").
3. **Buyer** → *View Offers* (cheapest first) → *Accept*. Other offers become *Rejected*, the requirement *Awarded*, an order is created, dealers are notified.
4. **Dealer** → *Orders* → *Mark Delivered*.

## Features

Reverse bidding · new/used browsing with filters & pagination · Compare Lab (max 4) · fair-price meter · Smart Match quiz ·
TCO calculator · EMI + on-road price · reviews · test-drive booking (dealer confirms) · dealer↔buyer chat + activity feed ·
dealer inventory management · admin overview.

## XML Lab (Experiment 8)

`/#!/xml-lab` — the live car catalog as XML, shown raw, CSS-styled, or transformed to an HTML table with XSLT, plus an XML
formatter/validator. API: `GET /api/xml/cars?mode=raw|css|xsl|html`, `POST /api/xml/validate`, `POST /api/xml/format`.
Step-by-step mapping of the experiment to this project: [`docs/EXPERIMENT_8_XML.md`](docs/EXPERIMENT_8_XML.md).

## Tests

```bash
npm test            # end-to-end API suites + XML suite (embedded SQLite, zero setup)
npm run test:xml    # Experiment 8 XML tests only
npm run test:mysql  # same suite against your MySQL (database `autobid_test`)
npm run test:ui     # loads the real AngularJS app in jsdom and clicks through the whole flow
npm run test:unit   # Jasmine regression specs (5 documented bug classes)
npm run test:all    # everything
```

## Architecture

```
Express (port 3000)
├── SQL    — MySQL (mysql2) or embedded SQLite (sql.js); same queries on both
├── Mongo  — chat, activity, reviews (fallback: data/fallback.json)
└── Static — AngularJS 1.8 SPA (public/)

django_service/ — optional original Django/DRF side service (admin + DRF endpoints).
                  The app no longer depends on it: fair-price is now served by Express (/api/cars/:id/fair-price).
```

Every write route checks role **and** ownership (a buyer can only accept offers on their own requirements, a dealer can
only edit their own offers/cars, chat only for participants…). Dealer/admin writes also need the `x-api-key` header
(`demo-key`, sent automatically by the frontend).

## Cars, variants & specs

A **car** (e.g. *Maruti Suzuki Swift*) is listed **once**; its **variants** (LXI, VXI, VXI CNG, ZXI …) are picked on the car's page.
Every variant stores its own specs — fuel, engine, power, torque, mileage (km/kg for CNG) or battery/range (EVs), boot space,
airbags, safety rating, weight, and a feature list — so the specs, price, dealer and listing on the page change when the variant changes.
`GET /api/cars?type=new&group=model` returns one entry per car; `GET /api/cars/:id` returns the car with all variants and their specs.
Reviews are shared across all variants of a car.

> Upgrading an existing database: on start-up the server detects the old layout and rebuilds the demo data automatically.

## Machine learning

| Where | Model | What it does |
|---|---|---|
| Fair-price meter, dealer "Estimate fair price" | Gradient Boosting regressor (`ml/train.py`) | Predicts a used car's market value (with a likely range) from age, km, owners, brand, body, fuel, transmission, ex-showroom price |
| Dealer dashboard → "Suggest a competitive bid" | Gradient Boosting regressor | Predicts the typical winning offer for a buyer requirement (budget, body, fuel, city, timeline, competing offers) |
| Smart Match quiz | Content-based k-nearest-neighbours (`services/recommender.js`) | Ranks cars by weighted similarity to the quiz answers; one result per car (its best variant) |
| "Similar cars" on the car page | Item-to-item nearest neighbours | Finds cars closest in price / seating / body / fuel / safety / power space |

Models are trained in Python and exported to `ml/models/*.json`; the Node server evaluates them itself, so **`npm start` needs no Python**.
Retrain with `pip install scikit-learn numpy pandas && npm run train`.

**Important:** with no dataset the training data is *synthetic* (rules + noise), because none ships with the project. The pipeline is real;
for real accuracy train on real data: `python ml/train.py --used-csv cars.csv` (columns are listed at the top of `ml/train.py`).
The bid model is always synthetic — replace `synth_bids()` with real auction history if you have it.
