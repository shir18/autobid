/**
 * db.js — database layer with two interchangeable engines.
 *
 *   mysql  : mysql2 connection pool (the primary engine, as in the project spec)
 *   sqlite : embedded SQLite via sql.js (pure JS/WASM — nothing to install)
 *
 * DB_ENGINE=auto (default) tries MySQL first and silently falls back to the
 * embedded SQLite file (data/autobid.sqlite) so `npm start` always works.
 *
 * Public API (same for both engines, mysql2-promise compatible):
 *   await db.init()                 — choose engine, create DB/tables if needed
 *   await db.query(sql, params)     — returns [rows] or [{ insertId, affectedRows }]
 *   await db.getConnection()        — { query, beginTransaction, commit, rollback, release }
 *   await db.execScript(sqlText)    — run a multi-statement script
 *   db.engine                       — 'mysql' | 'sqlite'
 *
 * All queries must use parameterized placeholders (?).
 */
'use strict';
const fs     = require('fs');
const path   = require('path');
const config = require('./config');

const db = {
  engine: null,
  _impl:  null,
  async init() {
    if (this._impl) return this;
    const want = config.DB_ENGINE;
    if (want === 'mysql') {
      this._impl = await createMysql();
      this.engine = 'mysql';
    } else if (want === 'sqlite') {
      this._impl = await createSqlite();
      this.engine = 'sqlite';
    } else {
      try {
        this._impl = await createMysql();
        this.engine = 'mysql';
      } catch (err) {
        console.warn('[db] MySQL not available (' + (err.code || err.message) + ') — using embedded SQLite instead.');
        console.warn('[db] To use MySQL, start it and check MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD (see README).');
        this._impl = await createSqlite();
        this.engine = 'sqlite';
      }
    }
    console.log('[db] Using ' + this.engine.toUpperCase() +
      (this.engine === 'sqlite' ? ' (' + config.SQLITE_FILE + ')' : ' (' + config.MYSQL.host + ':' + config.MYSQL.port + '/' + config.MYSQL.database + ')'));
    return this;
  },
  query(sql, params)   { return need(this).query(sql, params); },
  getConnection()      { return need(this).getConnection(); },
  execScript(sql)      { return need(this).execScript(sql); },
  close()              { return this._impl ? this._impl.close() : Promise.resolve(); }
};

function need(d) {
  if (!d._impl) throw new Error('Database not initialised — call db.init() first');
  return d._impl;
}

// ─────────────────────────────────────────────────────────────────────────────
// MySQL engine
// ─────────────────────────────────────────────────────────────────────────────
async function createMysql() {
  const mysql = require('mysql2/promise');
  const c = config.MYSQL;

  // 1. Connect to the server (no database yet) and make sure the database exists
  const admin = await mysql.createConnection({
    host: c.host, port: c.port, user: c.user, password: c.password,
    connectTimeout: 3000, multipleStatements: true
  });
  await admin.query('CREATE DATABASE IF NOT EXISTS `' + c.database.replace(/`/g, '') + '`');
  await admin.end();

  // 2. Regular pool bound to the database
  const pool = mysql.createPool({
    host: c.host, port: c.port, user: c.user, password: c.password, database: c.database,
    waitForConnections: true, connectionLimit: 10, queueLimit: 0,
    timezone: '+00:00', decimalNumbers: true, connectTimeout: 5000
  });
  await pool.query('SELECT 1');

  return {
    query: (sql, params) => pool.query(sql, params),
    async getConnection() {
      const conn = await pool.getConnection();
      return {
        query: (sql, params) => conn.query(sql, params),
        beginTransaction: () => conn.beginTransaction(),
        commit:   () => conn.commit(),
        rollback: () => conn.rollback(),
        release:  () => conn.release()
      };
    },
    async execScript(script) {
      const conn = await mysql.createConnection({
        host: c.host, port: c.port, user: c.user, password: c.password,
        database: c.database, multipleStatements: true
      });
      try { await conn.query(script); } finally { await conn.end(); }
    },
    close: () => pool.end()
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SQLite engine (sql.js) — with a tiny MySQL→SQLite dialect translator
// ─────────────────────────────────────────────────────────────────────────────
async function createSqlite() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const file = config.SQLITE_FILE;
  fs.mkdirSync(path.dirname(file), { recursive: true });

  let sdb = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
  sdb.run('PRAGMA foreign_keys = ON');

  // ── persistence (debounced) ──
  let saveTimer = null, inTx = false;
  function save() {
    if (inTx) { schedule(); return; }
    try {
      const data = sdb.export();            // NOTE: export() resets PRAGMAs
      fs.writeFileSync(file, Buffer.from(data));
      sdb.run('PRAGMA foreign_keys = ON');
    } catch (e) { console.warn('[db] could not save SQLite file:', e.message); }
  }
  function schedule() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; save(); }, 250);
    if (saveTimer.unref) saveTimer.unref();
  }

  // ── async mutex (single shared connection) ──
  let tail = Promise.resolve();
  function acquire() {
    let release;
    const next = new Promise(r => { release = r; });
    const prev = tail;
    tail = prev.then(() => next);
    return prev.then(() => release);
  }

  // ── dialect translation ──
  function translate(sql) {
    return sql
      .replace(/FIND_IN_SET\(\s*\?\s*,\s*([\w.]+)\s*\)/gi, "(',' || $1 || ',') LIKE ('%,' || ? || ',%')")
      .replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT OR IGNORE INTO')
      .replace(/\s+FOR\s+UPDATE/gi, '')
      .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');
  }
  function normParam(p) {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (p instanceof Date) return p.toISOString().slice(0, 19).replace('T', ' ');
    return p;
  }
  const TS = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/;
  function normRow(row) {
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (typeof v === 'string' && TS.test(v)) row[k] = v.replace(' ', 'T') + '.000Z';
    }
    return row;
  }

  function run(sql, params) {
    const q = translate(sql);
    const p = (params || []).map(normParam);
    if (/^\s*(SELECT|WITH|PRAGMA)/i.test(q)) {
      const stmt = sdb.prepare(q);
      try {
        stmt.bind(p);
        const rows = [];
        while (stmt.step()) rows.push(normRow(stmt.getAsObject()));
        return [rows];
      } finally { stmt.free(); }
    }
    sdb.run(q, p);
    const affectedRows = sdb.getRowsModified();
    let insertId = 0;
    if (/^\s*INSERT/i.test(q)) {
      const r = sdb.exec('SELECT last_insert_rowid()');
      insertId = r[0] ? r[0].values[0][0] : 0;
    }
    if (!inTx) schedule();
    return [{ insertId, affectedRows }];
  }

  return {
    async query(sql, params) {
      const release = await acquire();
      try { return run(sql, params); } finally { release(); }
    },
    async getConnection() {
      const release = await acquire();
      let released = false;
      return {
        query: async (sql, params) => run(sql, params),
        async beginTransaction() { sdb.run('BEGIN'); inTx = true; },
        async commit()   { if (inTx) { sdb.run('COMMIT'); inTx = false; schedule(); } },
        async rollback() { if (inTx) { try { sdb.run('ROLLBACK'); } catch (e) { /* nothing to roll back */ } inTx = false; } },
        release() { if (!released) { released = true; inTx = false; release(); } }
      };
    },
    async execScript(script) {
      const release = await acquire();
      try { sdb.exec(script); if (!inTx) schedule(); } finally { release(); }
    },
    async close() {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      save();
      sdb.close();
    }
  };
}

module.exports = db;
