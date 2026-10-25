/**
 * config.js — central configuration (all values overridable with env vars).
 */
'use strict';
module.exports = {
  PORT:       parseInt(process.env.PORT, 10) || 3000,
  API_KEY:    process.env.API_KEY    || 'demo-key',
  JWT_SECRET: process.env.JWT_SECRET || 'autobid-dev-secret',
  // DB_ENGINE: 'auto' (try MySQL, fall back to embedded SQLite), 'mysql' or 'sqlite'
  DB_ENGINE:  (process.env.DB_ENGINE || 'auto').toLowerCase(),
  MYSQL: {
    host:     process.env.MYSQL_HOST     || 'localhost',
    port:     parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user:     process.env.MYSQL_USER     || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DB       || 'autobid'
  },
  SQLITE_FILE: process.env.SQLITE_FILE || require('path').join(__dirname, 'data', 'autobid.sqlite')
};
