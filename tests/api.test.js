/**
 * tests/api.test.js — end-to-end API tests (node:test, no extra dependencies).
 *
 *   npm test                       → runs against the embedded SQLite engine (zero setup)
 *   DB_ENGINE=mysql npm test       → runs against your MySQL (uses/creates the `autobid_test` database)
 *
 * The suite boots the real Express app on a random port, so it exercises routes,
 * middleware, JWT auth, SQL and the reverse-bidding transaction together.
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

// Isolated data files / database for the test run (must be set BEFORE requiring the app)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'autobid-test-'));
process.env.DB_ENGINE     = process.env.DB_ENGINE || 'sqlite';
process.env.SQLITE_FILE   = path.join(tmp, 'test.sqlite');
process.env.FALLBACK_FILE = path.join(tmp, 'fallback.json');
process.env.MONGO_URI     = 'mongodb://127.0.0.1:1/none';   // force the file fallback in tests
if (process.env.DB_ENGINE === 'mysql') process.env.MYSQL_DB = 'autobid_test';

const { start } = require('../server');
const db = require('../db');

let server, base;
const tokens = {};

async function api(method, url, { body, token, key = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (key)   headers['x-api-key'] = 'demo-key';
  const res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  return { status: res.status, data };
}
async function login(email, password) {
  const r = await api('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(r.status, 200, 'login ' + email);
  return r.data;
}

test.before(async () => {
  server = await start(0);
  base = 'http://127.0.0.1:' + server.address().port;
  tokens.buyer  = (await login('buyer@demo.com', 'buyer123')).token;
  tokens.dealer = (await login('dealer@demo.com', 'dealer123')).token;
  tokens.admin  = (await login('admin@demo.com', 'admin123')).token;
});
test.after(async () => { server.close(); await db.close(); });

test('health + seeded catalogue', async () => {
  const h = await api('GET', '/api/health');
  assert.equal(h.data.ok, true);
  const brands = await api('GET', '/api/brands');
  assert.equal(brands.data.length, 12);
  const all = await api('GET', '/api/cars?type=new&limit=500');
  assert.equal(all.data.total, 118);          // 118 variant listings …
  assert.equal(all.data.data.length, 118);
  const grouped = await api('GET', '/api/cars?type=new&group=model&limit=500');
  assert.equal(grouped.data.total, 30);       // … belonging to 30 cars (one card per car)
  const used = await api('GET', '/api/cars?type=used');
  assert.equal(used.data.total, 40);
});

test('car filters, sorting, pagination', async () => {
  const diesel = await api('GET', '/api/cars?type=new&fuel=Diesel&limit=500');
  assert.ok(diesel.data.total > 0);
  assert.ok(diesel.data.data.every(c => c.fuel_type.split(',').includes('Diesel')));
  const suv = await api('GET', '/api/cars?bodyType=SUV&type=new&maxPrice=1500000&limit=500');
  assert.ok(suv.data.data.every(c => c.body_type === 'SUV' && Number(c.listing_price) <= 1500000));
  const sorted = await api('GET', '/api/cars?type=new&sort=price_desc');
  const prices = sorted.data.data.map(c => Number(c.listing_price));
  assert.deepEqual(prices, prices.slice().sort((a, b) => b - a));
  const p2 = await api('GET', '/api/cars?type=new&page=2');
  assert.equal(p2.data.page, 2);
  assert.equal(p2.data.data.length, 12);
  const brand = await api('GET', '/api/cars?brand=hyundai&type=new&limit=500');
  assert.ok(brand.data.data.every(c => c.brand_slug === 'hyundai'));
});

test('car detail, variants, compare order, fair price', async () => {
  const car = (await api('GET', '/api/cars/1')).data;
  assert.equal(car.id, 1);
  assert.ok(car.variants.length >= 2);
  assert.ok(car.variants.some(v => v.id === car.variant_id));
  assert.equal((await api('GET', '/api/cars/99999')).status, 404);
  const cmp = (await api('GET', '/api/cars/compare?ids=3,1,2')).data;
  assert.deepEqual(cmp.map(c => c.id), [3, 1, 2]);
  const fp = (await api('GET', '/api/cars/1/fair-price')).data;
  assert.ok(['Great deal', 'Fair', 'Above market'].includes(fp.label));
  const usedId = (await api('GET', '/api/cars?type=used')).data.data[0].id;
  const fpu = (await api('GET', `/api/cars/${usedId}/fair-price`)).data;
  assert.ok(fpu.median_price > 0);
});

test('one car → many variants with their own specs', async () => {
  const g = (await api('GET', '/api/cars?type=new&group=model&limit=500')).data.data;
  assert.equal(new Set(g.map(c => c.model_id)).size, g.length, 'each car appears once');
  const swift = g.find(c => c.model_name === 'Swift');
  assert.ok(swift.variant_count >= 4 && swift.fuel_types.includes('CNG'));
  const car = (await api('GET', `/api/cars/${swift.id}`)).data;
  const lxi = car.variants.find(v => v.name === 'LXI'), cng = car.variants.find(v => v.name === 'VXI CNG'), zxi = car.variants.find(v => v.name === 'ZXI');
  assert.equal(lxi.fuel_type, 'Petrol'); assert.equal(cng.fuel_type, 'CNG');
  assert.notEqual(lxi.power_bhp, cng.power_bhp);              // specs differ per variant
  assert.notEqual(lxi.airbags, zxi.airbags);
  assert.ok(zxi.features.length > lxi.features.length);         // higher trim → more features
  assert.ok(car.variants.every(v => v.listing && v.listing.id));// each variant has its own listing
  const ev = (await api('GET', '/api/cars?type=new&fuel=Electric&limit=500')).data.data;
  assert.ok(ev.length >= 4 && ev.every(c => c.fuel_type === 'Electric' && c.range_km > 0));
});

test('ML: used-price model, similar cars, recommender, dealer hints', async () => {
  const used = (await api('GET', '/api/cars?type=used&limit=500')).data.data;
  const fp = (await api('GET', `/api/cars/${used[0].id}/fair-price`)).data;
  assert.equal(fp.method, 'ml'); assert.ok(fp.range_low < fp.predicted_price && fp.predicted_price < fp.range_high);
  const newer = used.filter(c => c.model_name === 'Swift').sort((a, b) => b.year - a.year);
  const p = id => api('GET', `/api/cars/${id}/fair-price`).then(r => r.data.predicted_price);
  assert.ok(await p(newer[0].id) > await p(newer[newer.length - 1].id), 'newer, lower-km car is worth more');

  const rec = (await api('POST', '/api/ml/recommend', { body: { budget: 1000000, usage: 'city', family: 4, fuel: 'Petrol', priority: 'mileage' } })).data;
  assert.equal(rec.length, 6); assert.equal(new Set(rec.map(r => r.car.model_id)).size, 6);
  assert.ok(rec[0].score >= rec[5].score && rec.every(r => Number(r.car.listing_price) > 0));
  assert.equal((await api('POST', '/api/ml/recommend', { body: { budget: 1 } })).status, 400);
  const sim = (await api('GET', '/api/ml/similar/1')).data;
  assert.equal(sim.length, 4); assert.ok(sim.every(c => c.model_name !== 'Swift'));

  assert.equal((await api('GET', '/api/ml/used-price?variant_id=1&year=2021', { token: tokens.buyer })).status, 403);
  const est = (await api('GET', '/api/ml/used-price?variant_id=1&year=2021&km_driven=30000', { token: tokens.dealer })).data;
  assert.ok(est.price > 100000 && est.low < est.price && est.price < est.high);
  const reqs = (await api('GET', '/api/requirements?status=open', { token: tokens.dealer })).data;
  const bid = (await api('GET', `/api/ml/bid-suggestion/${reqs[0].id}`, { token: tokens.dealer })).data;
  assert.ok(bid.suggested_price >= reqs[0].budget_min * 0.6 && bid.suggested_price <= reqs[0].budget_max);
});

test('registration rules and dealer onboarding', async () => {
  assert.equal((await api('POST', '/api/auth/register', { body: { email: 'bad', password: 'secret1', name: 'X' } })).status, 400);
  assert.equal((await api('POST', '/api/auth/register', { body: { email: 'a@b.co', password: '123', name: 'X' } })).status, 400);
  assert.equal((await api('POST', '/api/auth/register', { body: { email: 'root@b.co', password: 'secret1', name: 'X', role: 'admin' } })).status, 400);
  assert.equal((await api('POST', '/api/auth/register', { body: { email: 'buyer@demo.com', password: 'secret1', name: 'X' } })).status, 409);

  const r = await api('POST', '/api/auth/register', { body: { email: 'NewDealer@Test.com', password: 'secret1', name: 'Nina', role: 'dealer', dealership: 'Nina Motors', city: 'Chennai' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, 'dealer');
  assert.equal(r.data.dealer.name, 'Nina Motors');
  tokens.newDealer = r.data.token;
  const me = await api('GET', '/api/dealers/me', { token: tokens.newDealer });
  assert.equal(me.data.city, 'Chennai');

  const bad = await api('POST', '/api/auth/login', { body: { email: 'buyer@demo.com', password: 'wrong' } });
  assert.equal(bad.status, 401);
});

test('auth guards', async () => {
  assert.equal((await api('GET', '/api/requirements')).status, 401);
  assert.equal((await api('POST', '/api/requirements', { token: tokens.dealer, body: { budget_min: 1, budget_max: 2, city: 'Delhi' } })).status, 403);
  assert.equal((await api('POST', '/api/offers', { key: false, token: tokens.dealer, body: { requirement_id: 1, price: 1, delivery_days: 1 } })).status, 401);
  assert.equal((await api('GET', '/api/admin/stats', { token: tokens.buyer })).status, 403);
});

test('REVERSE BIDDING: post → bid → revise → accept atomically', async () => {
  // buyer posts a requirement (validation first)
  const badReq = await api('POST', '/api/requirements', { token: tokens.buyer, body: { budget_min: 900000, budget_max: 500000, city: 'Delhi' } });
  assert.equal(badReq.status, 400);
  const created = await api('POST', '/api/requirements', { token: tokens.buyer, body: { budget_min: 700000, budget_max: 1100000, body_type: 'SUV', fuel: 'Petrol', city: 'Delhi', timeline_days: 21 } });
  assert.equal(created.status, 201);
  const reqId = created.data.id;

  // two dealers bid (demo dealer + freshly registered dealer)
  const o1 = await api('POST', '/api/offers', { token: tokens.dealer, body: { requirement_id: reqId, price: 990000, delivery_days: 10, freebies: 'Free service' } });
  assert.equal(o1.status, 201);
  const o2 = await api('POST', '/api/offers', { token: tokens.newDealer, body: { requirement_id: reqId, price: 950000, delivery_days: 14 } });
  assert.equal(o2.status, 201);

  // duplicates and invalid prices are rejected
  assert.equal((await api('POST', '/api/offers', { token: tokens.dealer, body: { requirement_id: reqId, price: 980000, delivery_days: 9 } })).status, 409);
  assert.equal((await api('POST', '/api/offers', { token: tokens.buyer, body: { requirement_id: reqId, price: 980000, delivery_days: 9 } })).status, 403);

  // dealer revises (bids down)
  const upd = await api('PATCH', `/api/offers/${o1.data.id}`, { token: tokens.dealer, body: { price: 940000 } });
  assert.equal(upd.status, 200);
  assert.equal((await api('PATCH', `/api/offers/${o1.data.id}`, { token: tokens.newDealer, body: { price: 1 } })).status, 403);

  // dealer sees lowest bid + own bid on the requirement list; buyer sees offers sorted by price
  const dl = (await api('GET', '/api/requirements?status=open', { token: tokens.dealer })).data.find(r => r.id === reqId);
  assert.equal(Number(dl.lowest_offer), 940000);
  assert.equal(Number(dl.my_offer_price), 940000);
  assert.equal(dl.offer_count, 2);
  const offers = (await api('GET', `/api/offers/requirement/${reqId}`, { token: tokens.buyer })).data;
  assert.deepEqual(offers.map(o => Number(o.price)), [940000, 950000]);
  assert.equal((await api('GET', `/api/offers/requirement/${reqId}`, { token: tokens.dealer })).status, 403);

  // buyer's activity feed shows the new offers
  const feed = (await api('GET', '/api/activity/mine', { token: tokens.buyer })).data;
  assert.ok(feed.filter(a => a.type === 'new_offer').length >= 2);

  // a different buyer cannot accept
  const other = await api('POST', '/api/auth/register', { body: { email: 'other@buyer.com', password: 'secret1', name: 'Other' } });
  assert.equal((await api('PATCH', `/api/offers/${o2.data.id}/accept`, { token: other.data.token })).status, 403);
  // a dealer cannot accept
  assert.equal((await api('PATCH', `/api/offers/${o2.data.id}/accept`, { token: tokens.dealer })).status, 403);

  // owner accepts the *second* offer → everything else rejected, requirement awarded, order created
  const acc = await api('PATCH', `/api/offers/${o2.data.id}/accept`, { token: tokens.buyer });
  assert.equal(acc.status, 200);
  assert.ok(acc.data.orderId);
  const after = (await api('GET', `/api/offers/requirement/${reqId}`, { token: tokens.buyer })).data;
  assert.equal(after.find(o => o.id === o2.data.id).status, 'accepted');
  assert.equal(after.find(o => o.id === o1.data.id).status, 'rejected');
  const rq = (await api('GET', `/api/requirements/${reqId}`, { token: tokens.buyer })).data;
  assert.equal(rq.status, 'awarded');
  assert.equal((await api('PATCH', `/api/offers/${o2.data.id}/accept`, { token: tokens.buyer })).status, 404);   // already processed
  assert.equal((await api('POST', '/api/offers', { token: tokens.dealer, body: { requirement_id: reqId, price: 1, delivery_days: 1 } })).status, 400);

  // notifications for dealers
  const wFeed = (await api('GET', '/api/activity/mine', { token: tokens.newDealer })).data;
  assert.ok(wFeed.some(a => a.type === 'offer_accepted'));
  const lFeed = (await api('GET', '/api/activity/mine', { token: tokens.dealer })).data;
  assert.ok(lFeed.some(a => a.type === 'offer_rejected'));

  // orders: buyer + winning dealer see it, the losing dealer does not
  const bo = (await api('GET', '/api/orders/mine', { token: tokens.buyer })).data;
  const order = bo.find(o => o.id === acc.data.orderId);
  assert.ok(order); assert.equal(order.status, 'confirmed'); assert.equal(Number(order.offer_price), 950000);
  const wo = (await api('GET', '/api/orders/mine', { token: tokens.newDealer })).data;
  assert.ok(wo.some(o => o.id === order.id));
  const lo = (await api('GET', '/api/orders/mine', { token: tokens.dealer })).data;
  assert.ok(!lo.some(o => o.id === order.id));
  const counts = (await api('GET', '/api/orders/counts', { token: tokens.buyer })).data;
  assert.ok(counts.find(c => c.status === 'confirmed').count >= 1);

  // only the owning dealer may deliver; buyer may only cancel
  assert.equal((await api('PATCH', `/api/orders/${order.id}/status`, { token: tokens.dealer, body: { status: 'delivered' } })).status, 403);
  assert.equal((await api('PATCH', `/api/orders/${order.id}/status`, { token: tokens.buyer, body: { status: 'delivered' } })).status, 403);
  assert.equal((await api('PATCH', `/api/orders/${order.id}/status`, { token: tokens.newDealer, body: { status: 'delivered' } })).status, 200);
  assert.equal((await api('PATCH', `/api/orders/${order.id}/status`, { token: tokens.newDealer, body: { status: 'cancelled' } })).status, 400);
});

test('closing a requirement rejects pending offers', async () => {
  const id = (await api('POST', '/api/requirements', { token: tokens.buyer, body: { budget_min: 400000, budget_max: 600000, city: 'Mumbai' } })).data.id;
  const o = await api('POST', '/api/offers', { token: tokens.dealer, body: { requirement_id: id, price: 500000, delivery_days: 5 } });
  assert.equal(o.status, 201);
  assert.equal((await api('PATCH', `/api/requirements/${id}`, { token: tokens.dealer })).status, 403);
  assert.equal((await api('PATCH', `/api/requirements/${id}`, { token: tokens.buyer })).status, 200);
  const offers = (await api('GET', `/api/offers/requirement/${id}`, { token: tokens.buyer })).data;
  assert.equal(offers[0].status, 'rejected');
  assert.equal((await api('POST', '/api/offers', { token: tokens.newDealer, body: { requirement_id: id, price: 1, delivery_days: 1 } })).status, 400);
});

test('test-drive bookings (ISO dates accepted, dealer confirms)', async () => {
  const future = new Date(Date.now() + 5 * 86400000).toISOString();          // full ISO string like <input type=date> sends
  const past   = new Date(Date.now() - 5 * 86400000).toISOString();
  assert.equal((await api('POST', '/api/dealers/bookings', { token: tokens.buyer, body: { car_id: 1, scheduled_date: past } })).status, 400);
  assert.equal((await api('POST', '/api/dealers/bookings', { token: tokens.buyer, body: { car_id: 1, scheduled_date: 'nonsense' } })).status, 400);
  const b = await api('POST', '/api/dealers/bookings', { token: tokens.buyer, body: { car_id: 1, scheduled_date: future, notes: 'morning please' } });
  assert.equal(b.status, 201);

  const mine = (await api('GET', '/api/dealers/bookings/user/' + (await login('buyer@demo.com', 'buyer123')).user.id, { token: tokens.buyer })).data;
  assert.ok(mine.some(x => x.id === b.data.id && x.model_name));
  assert.equal((await api('GET', '/api/dealers/bookings/user/999', { token: tokens.buyer })).status, 403);

  // car 1 belongs to dealer 1 = the demo dealer
  const dealerList = (await api('GET', '/api/dealers/me/bookings', { token: tokens.dealer })).data;
  assert.ok(dealerList.some(x => x.id === b.data.id));
  assert.equal((await api('PATCH', `/api/dealers/bookings/${b.data.id}`, { token: tokens.newDealer, body: { status: 'confirmed' } })).status, 403);
  assert.equal((await api('PATCH', `/api/dealers/bookings/${b.data.id}`, { token: tokens.dealer, body: { status: 'confirmed' } })).status, 200);
  const feed = (await api('GET', '/api/activity/mine', { token: tokens.buyer })).data;
  assert.ok(feed.some(a => a.type === 'booking_confirmed'));
});

test('shortlist is private to the logged-in user', async () => {
  const buyer = await login('buyer@demo.com', 'buyer123');
  assert.equal((await api('POST', '/api/cars/shortlist', { token: tokens.buyer, body: { user_id: buyer.user.id, car_id: 5 } })).status, 201);
  assert.equal((await api('POST', '/api/cars/shortlist', { token: tokens.buyer, body: { user_id: buyer.user.id, car_id: 5 } })).status, 201); // idempotent
  const list = (await api('GET', '/api/cars/shortlist/' + buyer.user.id, { token: tokens.buyer })).data;
  assert.equal(list.filter(c => c.id === 5).length, 1);
  assert.equal((await api('GET', '/api/cars/shortlist/' + buyer.user.id, { token: tokens.dealer })).status, 403);
  assert.equal((await api('DELETE', `/api/cars/shortlist/${buyer.user.id}/5`, { token: tokens.buyer })).status, 200);
  assert.equal((await api('GET', '/api/cars/shortlist/' + buyer.user.id, { token: tokens.buyer })).data.length, 0);
});

test('reviews (validation, ordering, author name)', async () => {
  assert.equal((await api('POST', '/api/reviews/car/1', { body: { rating: 5 } })).status, 401);
  assert.equal((await api('POST', '/api/reviews/car/1', { token: tokens.buyer, body: { rating: 9 } })).status, 400);
  const r = await api('POST', '/api/reviews/car/1', { token: tokens.buyer, body: { rating: 4, title: 'Nice', body: 'Smooth ride', pros: ['mileage', 'boot'], cons: [] } });
  assert.equal(r.status, 201);
  const list = (await api('GET', '/api/reviews/car/1')).data;   // car id in the URL is a string → must still match
  assert.equal(list.length, 1);
  assert.equal(list[0].user_name, 'Arjun Mehta');
  assert.deepEqual(list[0].pros, ['mileage', 'boot']);
});

test('dealer chat', async () => {
  const dealerUser = (await login('dealer@demo.com', 'dealer123')).user;
  const c = await api('POST', '/api/chat/conversations', { token: tokens.buyer, body: { with_user_id: dealerUser.id, car_id: 1 } });
  assert.equal(c.status, 201);
  assert.ok(c.data.car_label);
  const again = await api('POST', '/api/chat/conversations', { token: tokens.buyer, body: { with_user_id: dealerUser.id, car_id: 1 } });
  assert.equal(again.data._id, c.data._id);                       // de-duplicated
  assert.equal((await api('POST', '/api/chat/conversations', { token: tokens.buyer, body: { with_user_id: 9999 } })).status, 404);

  const cid = c.data._id;
  assert.equal((await api('POST', '/api/chat/messages', { token: tokens.buyer, body: { conversation_id: cid, text: '   ' } })).status, 400);
  const m1 = await api('POST', '/api/chat/messages', { token: tokens.buyer, body: { conversation_id: cid, text: 'Is it available?' } });
  assert.equal(m1.status, 201);
  const m2 = await api('POST', '/api/chat/messages', { token: tokens.dealer, body: { conversation_id: cid, text: 'Yes, come by!' } });
  assert.equal(m2.status, 201);

  const msgs = (await api('GET', '/api/chat/messages/' + cid, { token: tokens.buyer })).data;
  assert.deepEqual(msgs.map(m => m.text), ['Is it available?', 'Yes, come by!']);
  assert.ok(msgs[0].timestamp);
  assert.equal((await api('GET', '/api/chat/messages/' + cid, { token: tokens.newDealer })).status, 403);   // not a participant

  const convs = (await api('GET', '/api/chat/conversations', { token: tokens.dealer })).data;
  assert.ok(convs.find(x => x._id === cid).participant_info.some(p => p.name === 'Arjun Mehta'));
  const feed = (await api('GET', '/api/activity/mine', { token: tokens.dealer })).data;
  assert.ok(feed.some(a => a.type === 'message_received'));
});

test('dealer inventory management', async () => {
  const variant = (await api('GET', '/api/cars/variants')).data[0];
  const created = await api('POST', '/api/cars', { token: tokens.newDealer, body: { variant_id: variant.id, type: 'used', year: 2020, km_driven: 30000, owner_count: 1, city: 'Chennai', listing_price: 450000 } });
  assert.equal(created.status, 201);
  const id = created.data.id;
  const mineList = (await api('GET', '/api/cars?dealer_id=' + (await api('GET', '/api/dealers/me', { token: tokens.newDealer })).data.id + '&type=used')).data;
  assert.ok(mineList.data.some(c => c.id === id));

  assert.equal((await api('PATCH', `/api/cars/${id}`, { token: tokens.dealer, body: { status: 'sold' } })).status, 403);   // someone else's stock
  assert.equal((await api('PATCH', `/api/cars/${id}`, { token: tokens.newDealer, body: { status: 'sold' } })).status, 200);
  const pub = (await api('GET', '/api/cars?type=used&limit=500')).data.data;
  assert.ok(!pub.some(c => c.id === id));                                                                            // sold cars leave the public list
  assert.equal((await api('DELETE', `/api/cars/${id}`, { token: tokens.newDealer })).status, 200);
  assert.equal((await api('GET', `/api/cars/${id}`)).status, 404);
});

test('admin stats + error handler + 404', async () => {
  const s = (await api('GET', '/api/admin/stats', { token: tokens.admin })).data;
  assert.ok(s.users.length >= 3 && s.dealers >= 10);
  assert.ok((await api('GET', '/api/admin/users', { token: tokens.admin })).data.length >= 12);
  const boom = await api('GET', '/api/boom');
  assert.equal(boom.status, 500);
  assert.match(boom.data.error, /Deliberate/);
  assert.equal((await api('GET', '/api/nope')).status, 404);
  const res = await fetch(base + '/api/health');
  assert.ok(res.headers.get('x-response-time'));
});
