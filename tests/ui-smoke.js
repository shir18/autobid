/**
 * tests/ui-smoke.js — loads the REAL AngularJS app (index.html + all scripts/templates)
 * in jsdom against a live server and drives it like a user: browse, login, post
 * requirement, bid, accept, chat, book, etc. Needs `jsdom` (npm i -D jsdom).
 *   node tests/ui-smoke.js
 */
'use strict';
const os = require('os'), path = require('path'), fs = require('fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'autobid-ui-'));
process.env.DB_ENGINE = process.env.DB_ENGINE || 'sqlite';
process.env.SQLITE_FILE = path.join(tmp, 'ui.sqlite');
process.env.FALLBACK_FILE = path.join(tmp, 'fb.json');
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/none';

const { JSDOM, VirtualConsole } = require('jsdom');
const { start } = require('../server');
const db = require('../db');

const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log('  ✓', name);
  else { failures++; console.log('  ✗', name, extra || ''); }
}

(async () => {
  const server = await start(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e.message || e).slice(0, 300)));
  vc.on('error', (...a) => errors.push(a.join(' ').slice(0, 300)));

  const dom = await JSDOM.fromURL(base + '/', { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, d = w.document;
  w.scrollTo = () => {}; w.confirm = () => true; w.prompt = () => '900000'; w.alert = () => {};

  const $ = sel => d.querySelector(sel);
  const $$ = sel => Array.from(d.querySelectorAll(sel));
  const text = () => d.body.textContent.replace(/\s+/g, ' ');
  const go = async (hash, ms = 900) => { w.location.hash = '#!' + hash; await sleep(ms); };
  const inj = () => w.angular.element(d.body).injector();
  const click = async (el, ms = 500) => { el.click(); await sleep(ms); };
  const setVal = async (el, v, ev = 'input') => { el.value = v; el.dispatchEvent(new w.Event(ev, { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(50); };
  const btn = label => $$('button, a.btn').find(b => b.textContent.trim().includes(label));
  const waitFor = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(100); } return null; };

  await sleep(1500);
  console.log('HOME');
  check('angular booted', !!w.angular && !!$('[ng-view]'));
  check('brands rendered', $$('.brand-card').length === 12, $$('.brand-card').length);
  check('trending cars rendered', $$('.car-card').length === 6, $$('.car-card').length);
  check('fair-price badges load', (await sleep(600), $$('.fair-price-badge').length > 0));

  console.log('NEW CARS');
  await go('/new-cars');
  check('12 cars on page 1', $$('.car-card').length === 12, $$('.car-card').length);
  check('one card per car (30 cars)', /\(30 results\)/.test(text()), text().match(/\(\d+ results\)/));
  check('cards show variant count, not a single variant', /variants · choose on the next page/.test(text()));
  await click(btn('›'), 700);
  check('page 2 loads', /Page|‹/.test(text()) && $$('.car-card').length === 12);
  await click($$('.car-card-footer button')[0], 200);
  check('compare bar appears', !!$('.compare-bar'));

  console.log('USED CARS + DETAIL');
  await go('/used-cars');
  check('used cars listed', $$('.car-card').length === 12);
  const href = $('.car-card a').getAttribute('href');
  await go(href.replace('#!', ''), 1200);
  check('detail page renders', !!$('.page-detail') && $('.detail-header h1').textContent.length > 3);
  check('EMI shown', (await click($$('.tab-btn').find(b => b.textContent === 'EMI')), /Monthly EMI/.test(text())));
  check('on-road price', (await click($$('.tab-btn').find(b => b.textContent.includes('On-Road'))), /Total On-Road/.test(text())));

  console.log('COMPARE');
  await go('/compare', 1200);
  check('compare table shows car', $$('.compare-car-col').length >= 1);

  console.log('QUIZ + TCO');
  await go('/quiz', 300);
  await waitFor(() => btn('Start Quiz'));
  await click(btn('Start Quiz'));
  for (let i = 0; i < 5; i++) await click($$('.quiz-option')[0], 250);
  await sleep(1200);
  check('quiz results', $$('.result-card').length === 6, $$('.result-card').length);
  await go('/tco', 1500);
  check('tco cars + result', $$('.tco-controls option').length > 50 && /Total 5-Year Cost/.test(text()));
  check('tco chart bars', $$('.tco-svg rect').length === 4);

  console.log('AUTH (buyer)');
  await go('/login');
  await setVal($('input[type=email]'), 'buyer@demo.com');
  await setVal($('input[type=password]'), 'buyer123');
  await click($('form button[type=submit]'), 1500);
  check('redirected to buyer dashboard', /Buyer Dashboard/.test(text()), w.location.hash);
  check('3 seeded requirements', $$('.req-card').length === 3, $$('.req-card').length);

  console.log('BUYER: post requirement');
  await click(btn('+ Post Requirement'), 200);
  const inputs = $$('.req-form input[type=number]');
  await setVal(inputs[0], '500000'); await setVal(inputs[1], '900000');
  const citySel = $$('.req-form select')[2];
  citySel.value = 'string:Delhi'; if (!Array.from(citySel.options).some(o => o.value === 'string:Delhi')) citySel.value = 'Delhi';
  citySel.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(50);
  await click(btn('Submit Requirement'), 1200);
  check('requirement posted', $$('.req-card').length === 4, $$('.req-card').length + ' ' + ($('.msg-error') || {}).textContent);

  console.log('BUYER: offers + accept');
  await click($$('.req-card').find(c => /3 offer/.test(c.textContent)) && $$('.req-card').find(c => /3 offer/.test(c.textContent)).querySelector('button.btn-outline'), 900);
  check('offers listed lowest-first', $$('.offer-row').length === 3);
  const prices = $$('.offer-row').map(r => Number((r.textContent.match(/₹([\d.]+) L/) || [0, 0])[1]));
  check('lowest badge shown', /Lowest/.test(text()));
  await click($$('.offer-row button.btn-primary')[0], 1200);
  check('accept updates panel', $$('.offer-row .badge-green').length >= 1 && /Accepted/.test(text()) && /Rejected/.test(text()));
  await click($$('.dash-tab').find(b => b.textContent.includes('Orders')), 900);
  check('order created', $$('.order-row').length === 1, $$('.order-row').length);

  console.log('VARIANT PICKER: specs change with the variant');
  await go('/new-cars/1', 1400);   // Swift
  const specRow = label => { const r = $$('.specs-table tr').find(tr => tr.querySelector('th') && tr.querySelector('th').textContent.trim() === label); return r ? r.querySelector('td').textContent.replace(/\s+/g, ' ').trim() : null; };
  const tabs = () => $$('.variant-tab');
  check('variant tabs shown', tabs().length >= 4, tabs().length);
  const before = { fuel: specRow('Fuel Type'), power: specRow('Max Power'), price: $('.ex-price').textContent, air: specRow('Airbags') };
  await click(tabs().find(t => /VXI CNG/.test(t.textContent)), 500);
  check('fuel changes to CNG', specRow('Fuel Type') === 'CNG' && before.fuel === 'Petrol', before.fuel + ' → ' + specRow('Fuel Type'));
  check('power changes', specRow('Max Power') !== before.power, before.power + ' → ' + specRow('Max Power'));
  check('price changes', $('.ex-price').textContent !== before.price);
  check('mileage unit becomes km/kg', /km\/kg/.test(specRow('Mileage') || ''));
  await click(tabs().find(t => /ZXI\+?\s/.test(t.textContent) || /^ZXI/.test(t.textContent.trim())), 500);
  check('airbags change on higher trim', specRow('Airbags') !== before.air, before.air + ' → ' + specRow('Airbags'));
  check('similar cars (ML) shown', $$('.similar-card').length === 4, $$('.similar-card').length);
  await go('/new-cars/1', 900);

  console.log('BUYER: shortlist + book test drive from detail page');
  await go('/new-cars/5', 1200);
  await click(btn('Shortlist'), 600);
  check('shortlisted', /Shortlisted/.test(text()));
  await click($$('.tab-btn').find(b => b.textContent.includes('Book Test Drive')), 200);
  const dateInput = $('.book-form input[type=date]');
  const fut = new Date(Date.now() + 3 * 864e5); const iso = fut.toISOString().slice(0, 10);
  dateInput.value = iso; dateInput.dispatchEvent(new w.Event('input', { bubbles: true })); dateInput.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(80);
  await click($('.book-form button.btn-primary'), 1000);
  check('test drive booked', /Test drive requested/.test(text()), ($('.alert-error') || {}).textContent);
  await click($$('.tab-btn').find(b => b.textContent.includes('Reviews')), 200);
  await setVal($('.review-form input[placeholder="Review title"]'), 'Great car');
  await setVal($('.review-form textarea'), 'Loved it');
  await click($('.review-form button.btn-primary'), 900);
  check('review posted', /Great car/.test(text()) && /by Arjun Mehta/.test(text()));

  console.log('CHAT (buyer → dealer)');
  await go('/new-cars/1', 1200);   // car 1 belongs to the demo dealer
  await click(btn('Chat with dealer'), 1500);
  check('chat opened with dealer', /#!\/chat|\/chat/.test(w.location.hash) && $$('.chat-thread').length === 1, w.location.hash);
  await setVal($('.chat-input'), 'Is this available this week?');
  await click($('.chat-input-row button'), 900);
  check('message shown as mine', $$('.msg-bubble.msg-mine').length === 1);

  console.log('DEALER');
  inj().get('AuthService').logout();
  await go('/login', 600);
  await setVal($('input[type=email]'), 'dealer@demo.com');
  await setVal($('input[type=password]'), 'dealer123');
  await click($('form button[type=submit]'), 1500);
  check('dealer dashboard', /Dealer Dashboard/.test(text()), w.location.hash);
  check('open requirements listed', $$('.req-card').length >= 3, $$('.req-card').length);
  const target = $$('.req-card').find(c => !/Your current offer/.test(c.textContent));
  const nums = target.querySelectorAll('.offer-form input[type=number]');
  await setVal(nums[0], '850000'); await setVal(nums[1], '9');
  await click(target.querySelector('.offer-form button.btn-primary'), 1200);
  check('offer submitted', /Offer submitted/.test(text()), ($('.alert-error') || {}).textContent);
  check('own offer shown after reload', /Your current offer/.test(text()));
  await click($$('.dash-tab').find(b => b.textContent.includes('Test Drives')), 900);
  check('dealer sees test-drive request', $$('.order-row').length >= 1);
  await click(btn('Confirm'), 700);
  check('dealer confirms test drive', /Confirmed/.test(text()));
  await click($$('.dash-tab').find(b => b.textContent.includes('Inventory')), 900);
  check('inventory listed', $$('.order-row').length > 3);
  await go('/chat', 1500);
  check('dealer sees buyer conversation', $$('.conv-item').length === 1);
  await click($('.conv-item'), 800);
  check('dealer sees the buyer message', /available this week/.test(text()));

  console.log('ADMIN');
  inj().get('AuthService').logout();
  await go('/login', 500);
  await setVal($('input[type=email]'), 'admin@demo.com');
  await setVal($('input[type=password]'), 'admin123');
  await click($('form button[type=submit]'), 1500);
  check('admin overview', /Admin Overview/.test(text()) && $$('.tco-card').length === 4, w.location.hash);

  console.log('REGISTER (new dealer)');
  inj().get('AuthService').logout();
  await go('/register', 600);
  const f = $('form');
  await setVal(f.querySelector('input[type=text]'), 'Rita Singh');
  await setVal(f.querySelector('input[type=email]'), 'rita' + Date.now() + '@x.com');
  await setVal(f.querySelector('input[type=password]'), 'secret12');
  const role = f.querySelector('select'); role.value = 'string:dealer'; if (![...role.options].some(o => o.value === 'string:dealer')) role.value = 'dealer';
  role.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(100);
  await click(f.querySelector('button[type=submit]'), 1500);
  check('new dealer lands on dashboard', /Dealer Dashboard/.test(text()), w.location.hash + ' ' + (($('.alert-error') || {}).textContent || ''));

  console.log('\nJS errors captured:', errors.length);
  errors.slice(0, 8).forEach(e => console.log('   !', e));
  console.log(failures === 0 && errors.length === 0 ? '\nUI SMOKE TEST: ALL PASSED' : '\nUI SMOKE TEST: ' + failures + ' failed check(s), ' + errors.length + ' js error(s)');
  dom.window.close(); server.close(); await db.close();
  process.exit(failures || errors.length ? 1 : 0);
})().catch(e => { console.error('SMOKE CRASH', e); process.exit(2); });
