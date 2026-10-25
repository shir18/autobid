#!/usr/bin/env python3
"""
ml/train.py — trains the AutoBid ML models and exports them as JSON so the Node
server can run them WITHOUT Python at runtime (`npm start` needs no ML setup).

  1. used_price.json — Gradient Boosting regressor: predicts a used car's fair market price
                       (used by the fair-price meter and the dealer "add listing" hint).
  2. bid_price.json  — Gradient Boosting regressor: predicts the typical WINNING offer for a
                       buyer requirement, as a fraction of the buyer's max budget (used to
                       suggest a competitive bid to dealers in the reverse-bidding flow).

Usage
  pip install scikit-learn numpy pandas
  python ml/train.py                       # trains on the built-in synthetic market data
  python ml/train.py --used-csv cars.csv   # train the price model on a REAL dataset instead

CSV columns for --used-csv (one row per sold/listed used car):
  brand,body_type,fuel,transmission,year,km_driven,owner_count,ex_showroom_price,selling_price
  (any Kaggle "used cars India" dataset can be mapped to these columns)

NOTE: with no --used-csv the training data is SYNTHETIC — generated from hand-written
depreciation rules plus random noise, because no real market data ships with the project.
The pipeline (features → model → JSON → server) is real; swap in real data for real accuracy.
"""
import argparse, json, math, os, random
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'models')
os.makedirs(OUT, exist_ok=True)
CURRENT_YEAR = 2026
rng = random.Random(42)
PARITY = {}
np.random.seed(42)

# ───────────────────────── shared categorical vocabularies ─────────────────────────
BRANDS = ['Maruti Suzuki', 'Hyundai', 'Tata Motors', 'Honda', 'Toyota', 'Kia', 'MG Motor',
          'Mahindra', 'Volkswagen', 'Skoda', 'Renault', 'Ford']
BODIES = ['Hatchback', 'Sedan', 'SUV', 'MUV']
FUELS = ['Petrol', 'Diesel', 'CNG', 'Hybrid', 'Electric']
TRANS = ['Manual', 'Automatic']

# Brand resale strength (market knowledge: Maruti / Toyota / Hyundai hold value best).
RESALE = {'Maruti Suzuki': 1.06, 'Toyota': 1.07, 'Hyundai': 1.02, 'Honda': 1.01, 'Mahindra': 1.0,
          'Kia': 1.0, 'Tata Motors': 0.95, 'MG Motor': 0.92, 'Volkswagen': 0.93, 'Skoda': 0.94,
          'Renault': 0.9, 'Ford': 0.88}
FUEL_ADJ = {'Petrol': 1.0, 'Diesel': 1.04, 'CNG': 0.95, 'Hybrid': 1.03, 'Electric': 0.86}


def encode_used(brand, body, fuel, trans, year, km, owners, ex_price):
    """Feature vector — MUST match services/ml.js encodeUsed()."""
    age = max(0, CURRENT_YEAR - year)
    row = [math.log(ex_price), age, km / 10000.0, owners, km / 10000.0 / max(1, age)]
    row += [1.0 if brand == b else 0.0 for b in BRANDS]
    row += [1.0 if body == b else 0.0 for b in BODIES]
    row += [1.0 if fuel == f else 0.0 for f in FUELS]
    row += [1.0 if trans == 'Automatic' else 0.0]
    return row


USED_FEATURES = (['log_ex_showroom', 'age', 'km_10k', 'owners', 'km_per_year_10k']
                 + ['brand=' + b for b in BRANDS] + ['body=' + b for b in BODIES]
                 + ['fuel=' + f for f in FUELS] + ['transmission=Automatic'])


def synth_used(n=9000):
    """Synthetic used-car market: price = ex-showroom × depreciation curve × condition × noise."""
    X, y = [], []
    for _ in range(n):
        brand = rng.choice(BRANDS)
        body = rng.choice(BODIES)
        fuel = rng.choices(FUELS, weights=[55, 25, 8, 6, 6])[0]
        trans = rng.choice(TRANS)
        ex = math.exp(rng.uniform(math.log(420000), math.log(3900000)))
        year = rng.randint(CURRENT_YEAR - 11, CURRENT_YEAR)
        age = CURRENT_YEAR - year
        km = max(500, int(rng.gauss(age * 10500 + 3000, 4500 + age * 900)))
        owners = min(4, max(1, int(rng.choices([1, 2, 3, 4], weights=[62, 27, 8, 3])[0])))
        # first-year drop, then ~9 %/yr with a floor
        base = 0.85 - 0.075 * max(0, age - 1) if age >= 1 else 0.93
        base = max(0.30, base)
        km_pen = 1 - max(-0.06, min(0.22, (km - age * 10000) / 100000 * 0.12))
        own_pen = 1 - 0.04 * (owners - 1)
        body_adj = {'SUV': 1.04, 'MUV': 1.02, 'Sedan': 0.96, 'Hatchback': 0.98}[body]
        trans_adj = 1.03 if trans == 'Automatic' else 1.0
        price = ex * base * km_pen * own_pen * RESALE[brand] * FUEL_ADJ[fuel] * body_adj * trans_adj
        price *= rng.gauss(1.0, 0.045)            # market noise
        X.append(encode_used(brand, body, fuel, trans, year, km, owners, ex))
        y.append(math.log(max(80000, price)))
    return np.array(X), np.array(y)


def load_used_csv(path):
    import pandas as pd
    df = pd.read_csv(path)
    X, y = [], []
    for _, r in df.iterrows():
        try:
            X.append(encode_used(str(r['brand']), str(r['body_type']), str(r['fuel']), str(r['transmission']),
                                 int(r['year']), float(r['km_driven']), int(r['owner_count']),
                                 float(r['ex_showroom_price'])))
            y.append(math.log(float(r['selling_price'])))
        except Exception:
            continue
    return np.array(X), np.array(y)


# ─────────────────────────── bid-price model (reverse bidding) ───────────────────────────
BID_BODIES = ['Hatchback', 'Sedan', 'SUV', 'MUV', 'Any']
BID_FUELS = ['Petrol', 'Diesel', 'CNG', 'Hybrid', 'Electric', 'Any']
CITY_TIER = {'Mumbai': 1, 'Delhi': 1, 'Bangalore': 1, 'Hyderabad': 2, 'Chennai': 2}


def encode_bid(budget_min, budget_max, body, fuel, city, timeline_days, n_offers):
    """Feature vector — MUST match services/ml.js encodeBid()."""
    mid = (budget_min + budget_max) / 2.0
    spread = (budget_max - budget_min) / max(1.0, budget_max)
    row = [math.log(max(1.0, budget_max)), math.log(max(1.0, mid)), spread, timeline_days, n_offers,
           float(CITY_TIER.get(city, 2))]
    row += [1.0 if body == b else 0.0 for b in BID_BODIES]
    row += [1.0 if fuel == f else 0.0 for f in BID_FUELS]
    return row


BID_FEATURES = (['log_budget_max', 'log_budget_mid', 'budget_spread', 'timeline_days', 'competing_offers', 'city_tier']
                + ['body=' + b for b in BID_BODIES] + ['fuel=' + f for f in BID_FUELS])


def synth_bids(n=6000):
    """Synthetic auction outcomes: more competing dealers + a longer timeline → a lower winning bid."""
    X, y = [], []
    cities = list(CITY_TIER)
    for _ in range(n):
        bmax = math.exp(rng.uniform(math.log(450000), math.log(4000000)))
        bmin = bmax * rng.uniform(0.55, 0.9)
        body = rng.choice(BID_BODIES)
        fuel = rng.choice(BID_FUELS)
        city = rng.choice(cities)
        timeline = rng.choice([7, 14, 20, 30, 45, 60, 90])
        n_off = rng.randint(0, 9)
        ratio = 0.90                                   # typical winning bid vs the buyer's max budget
        ratio -= 0.012 * n_off                          # competition drives the price down
        ratio -= 0.0006 * min(timeline, 90)             # patient buyers get better deals
        ratio += 0.02 if fuel in ('Electric', 'Hybrid') else 0.0   # scarce powertrains hold price
        ratio += 0.015 if body in ('SUV', 'MUV') else 0.0
        ratio += 0.01 if CITY_TIER[city] == 1 else 0.0
        ratio -= 0.06 * (1 - (bmin / bmax))             # wide budget range → dealers bid nearer the low end
        ratio = min(0.99, max(0.62, ratio + rng.gauss(0, 0.015)))
        X.append(encode_bid(bmin, bmax, body, fuel, city, timeline, n_off))
        y.append(ratio)
    return np.array(X), np.array(y)


# ─────────────────────────────── training + export ───────────────────────────────
def export_gbr(model, features, extra):
    trees = []
    for est in model.estimators_[:, 0]:
        t = est.tree_
        trees.append({
            'left': t.children_left.tolist(), 'right': t.children_right.tolist(),
            'feature': t.feature.tolist(), 'threshold': [round(float(v), 6) for v in t.threshold],
            'value': [round(float(v[0][0]), 6) for v in t.value],
        })
    init = float(model.init_.constant_.ravel()[0])
    return {'type': 'gradient_boosting_regressor', 'learning_rate': model.learning_rate, 'init': init,
            'features': features, 'trees': trees, **extra}


def train(name, X, y, features, extra, resid_scale=None):
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=7)
    model = GradientBoostingRegressor(n_estimators=140, learning_rate=0.08, max_depth=4,
                                      subsample=0.85, random_state=7)
    model.fit(Xtr, ytr)
    pred = model.predict(Xte)
    metrics = {'samples': int(len(X)), 'r2': round(float(r2_score(yte, pred)), 4)}
    if name == 'used_price':                     # target is log(price) → report in ₹ / %
        p, t = np.exp(pred), np.exp(yte)
        metrics['mae_inr'] = int(mean_absolute_error(t, p))
        metrics['mape_pct'] = round(float(np.mean(np.abs(p - t) / t) * 100), 2)
        extra = {**extra, 'residual_std': round(float(np.std(pred - yte)), 4)}   # for a ± price range
    else:
        metrics['mae_ratio'] = round(float(mean_absolute_error(yte, pred)), 4)
        extra = {**extra, 'residual_std': round(float(np.std(pred - yte)), 4)}
    blob = export_gbr(model, features, extra)
    # a few raw feature rows + sklearn's own predictions, so tests can prove the JS evaluator matches
    PARITY[name] = {'X': Xte[:6].tolist(), 'pred': [float(v) for v in model.predict(Xte[:6])]}
    with open(os.path.join(OUT, name + '.json'), 'w') as f:
        json.dump(blob, f, separators=(',', ':'))
    print(f'{name}: {metrics}')
    return metrics


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--used-csv', help='real used-car dataset (see file header for columns)')
    args = ap.parse_args()

    report = {}
    if args.used_csv:
        Xu, yu = load_used_csv(args.used_csv)
        source = 'csv:' + os.path.basename(args.used_csv)
    else:
        Xu, yu = synth_used()
        source = 'synthetic'
    report['used_price'] = {**train('used_price', Xu, yu, USED_FEATURES,
                                    {'target': 'log_price', 'current_year': CURRENT_YEAR,
                                     'brands': BRANDS, 'bodies': BODIES, 'fuels': FUELS}), 'data': source}

    Xb, yb = synth_bids()
    report['bid_price'] = {**train('bid_price', Xb, yb, BID_FEATURES,
                                   {'target': 'winning_bid_ratio', 'bodies': BID_BODIES, 'fuels': BID_FUELS,
                                    'city_tier': CITY_TIER}), 'data': 'synthetic'}

    with open(os.path.join(OUT, 'parity.json'), 'w') as f:
        json.dump(PARITY, f)
    with open(os.path.join(OUT, 'metrics.json'), 'w') as f:
        json.dump(report, f, indent=2)
    print('Saved models to', OUT)


if __name__ == '__main__':
    main()
