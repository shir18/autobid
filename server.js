/**
 * server.js — AutoBid Express API Server
 *
 * Express concepts demonstrated (required by spec):
 * 1. Middleware order: requestLogger → responseTime → cors → json → static → routers → 404 → errorHandler
 * 2. requireApiKey middleware gates admin/dealer write routes (on top of JWT auth)
 * 3. Route params AND query strings (see cars, requirements routes)
 * 4. router.route() chaining for GET/POST on same path
 * 5. Body validation via next(err) with err.status
 * 6. GET /api/boom — deliberate error demo for central error handler
 * 7. SQL: parameterized queries, GROUP BY, correlated subquery, atomic transaction (in controllers)
 *
 * Start-up: picks MySQL (or the embedded SQLite fallback), creates the database
 * and loads demo data automatically when it is empty, then boots Express.
 */
'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const config  = require('./config');
const db      = require('./db');
const { connectMongo } = require('./mongo');
const { ensureSeeded } = require('./scripts/seed');

// Middleware
const requestLogger = require('./middleware/requestLogger');
const responseTime  = require('./middleware/responseTime');
const errorHandler  = require('./middleware/errorHandler');

// Routers
const authRouter         = require('./routes/auth.routes');
const brandsRouter       = require('./routes/brands.routes');
const carsRouter         = require('./routes/cars.routes');
const dealersRouter      = require('./routes/dealers.routes');
const requirementsRouter = require('./routes/requirements.routes');
const offersRouter       = require('./routes/offers.routes');
const ordersRouter       = require('./routes/orders.routes');
const chatRouter         = require('./routes/chat.routes');
const reviewsRouter      = require('./routes/reviews.routes');
const activityRouter     = require('./routes/activity.routes');
const adminRouter        = require('./routes/admin.routes');
const mlRouter           = require('./routes/ml.routes');
const xmlRouter          = require('./routes/xml.routes');

function createApp() {
  const app = express();

  // ── MIDDLEWARE CHAIN (order is the Express concept) ────────────────────────
  app.use(requestLogger);                                  // 1. Log every API request
  app.use(responseTime);                                   // 2. Measure timing + X-Response-Time header
  app.use(cors({ origin: '*', exposedHeaders: ['X-Response-Time'] }));
  app.use(express.json({ limit: '1mb' }));                 // 3. Parse JSON bodies
  app.use(express.static(path.join(__dirname, 'public'))); // 4. Serve the AngularJS app

  // ── API ROUTERS ────────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => res.json({ ok: true, db: db.engine }));
  app.use('/api/auth',         authRouter);
  app.use('/api/brands',       brandsRouter);
  app.use('/api/cars',         carsRouter);
  app.use('/api/dealers',      dealersRouter);
  app.use('/api/requirements', requirementsRouter);
  app.use('/api/offers',       offersRouter);
  app.use('/api/orders',       ordersRouter);
  app.use('/api/chat',         chatRouter);
  app.use('/api/reviews',      reviewsRouter);
  app.use('/api/activity',     activityRouter);
  app.use('/api/admin',        adminRouter);
  app.use('/api/ml',           mlRouter);
  app.use('/api/xml',          xmlRouter);   // Experiment 8: XML catalog + formatter/validator

  // Express concept #6: Deliberate error route — demonstrates the central error handler
  app.get('/api/boom', (req, res, next) => {
    const err = new Error('Deliberate explosion for error handler demo');
    err.status = 500;
    next(err);
  });

  // ── 404 catch-all for /api routes ──────────────────────────────────────────
  app.use('/api', (req, res, next) => {
    const err = new Error(`API route not found: ${req.originalUrl}`);
    err.status = 404;
    next(err);
  });

  // ── SPA fallback: serve index.html for all non-api routes ──────────────────
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // ── CENTRAL ERROR HANDLER (4-arg, registered last) ─────────────────────────
  app.use(errorHandler);
  return app;
}

async function start(port = config.PORT) {
  await db.init();          // MySQL → SQLite fallback
  await ensureSeeded();     // demo data on first run
  await connectMongo();     // optional: chat/reviews/activity fall back to a file store

  const app = createApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const actual = server.address().port;
      console.log(`\n[server] AutoBid is running →  http://localhost:${actual}`);
      console.log(`[server] Database: ${db.engine.toUpperCase()}   |   API key: ${config.API_KEY}`);
      console.log('[server] Demo logins: buyer@demo.com / buyer123 · dealer@demo.com / dealer123 · admin@demo.com / admin123\n');
      resolve(server);
    });
    server.on('error', err => {
      if (err.code === 'EADDRINUSE') console.error(`[server] Port ${port} is already in use. Set another port, e.g.  PORT=3001 npm start`);
      reject(err);
    });
  });
}

module.exports = { createApp, start };

if (require.main === module) {
  start().catch(err => {
    console.error('[server] Fatal startup error:', err.message);
    process.exit(1);
  });
}
