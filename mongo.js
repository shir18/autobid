/**
 * mongo.js — Mongoose connection with a graceful, *persistent* fallback store.
 * If MongoDB is unreachable, chat / activity / reviews use a small JSON-file
 * store (data/fallback.json) so nothing is lost when the server restarts.
 * The Express server boots normally either way.
 */
'use strict';
const fs       = require('fs');
const path     = require('path');
const mongoose = require('mongoose');

let mongoAvailable = false;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/autobid';
const FALLBACK_FILE = process.env.FALLBACK_FILE || path.join(__dirname, 'data', 'fallback.json');

// ── in-memory collections, loaded from disk ──────────────────────────────────
let fallback = { conversations: [], messages: [], activities: [], reviews: [] };
try {
  if (fs.existsSync(FALLBACK_FILE)) {
    fallback = Object.assign(fallback, JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf8')));
  }
} catch (e) { console.warn('[mongo] could not read fallback file:', e.message); }

let saveTimer = null;
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(FALLBACK_FILE), { recursive: true });
      fs.writeFileSync(FALLBACK_FILE, JSON.stringify(fallback));
    } catch (e) { console.warn('[mongo] could not save fallback file:', e.message); }
  }, 250);
  if (saveTimer.unref) saveTimer.unref();
}

async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2500 });
    mongoAvailable = true;
    console.log('[mongo] Connected to MongoDB at', MONGO_URI);
  } catch (err) {
    console.warn('[mongo] MongoDB not available — chat, activity feed and reviews use the built-in file store.');
    mongoAvailable = false;
  }
}

let seq = 0;
function newId() {
  // 24-hex-char id, same shape as a Mongo ObjectId
  return Date.now().toString(16).padStart(12, '0') + (seq++ % 0xffffff).toString(16).padStart(6, '0') +
         Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

// A filter value matches when it is equal (as string) or, for array fields, contained.
function matches(item, filter) {
  return Object.entries(filter).every(([k, v]) => {
    const field = item[k];
    if (Array.isArray(field)) return field.map(String).includes(String(v));
    return String(field) === String(v);
  });
}

const fallbackStore = {
  isAvailable: () => mongoAvailable,

  insert(collection, doc) {
    const now = new Date().toISOString();
    const rec = Object.assign({}, doc, { _id: newId(), createdAt: now, created_at: now, timestamp: now });
    fallback[collection].push(rec);
    persist();
    return rec;
  },
  find(collection, filter = {}) {
    return (fallback[collection] || []).filter(item => matches(item, filter));
  },
  findOne(collection, filter = {}) {
    return this.find(collection, filter)[0] || null;
  },
  findById(collection, id) {
    return (fallback[collection] || []).find(item => item._id === String(id)) || null;
  }
};

module.exports = { connectMongo, fallbackStore };
