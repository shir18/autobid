/**
 * services/store.js — one async API for chat, reviews and the activity feed.
 * Uses MongoDB (Mongoose) when connected, otherwise the JSON-file fallback,
 * so routes/controllers never need to care which one is active.
 */
'use strict';
const { fallbackStore } = require('../mongo');

let Conversation, Message, Review, Activity;
try {
  Conversation = require('../models/mongo/conversation.model');
  Message      = require('../models/mongo/message.model');
  Review       = require('../models/mongo/review.model');
  Activity     = require('../models/mongo/activity.model');
} catch (e) { /* mongoose models unavailable → fallback only */ }

const useMongo = () => fallbackStore.isAvailable() && Conversation;
const plain = d => (d && typeof d.toObject === 'function' ? d.toObject() : d);
const byTime = key => (a, b) => new Date(a[key]) - new Date(b[key]);

// ── Chat ─────────────────────────────────────────────────────────────────────
const chat = {
  async listConversations(userId) {
    const uid = String(userId);
    if (useMongo()) return (await Conversation.find({ participants: uid }).sort({ created_at: -1 })).map(plain);
    return fallbackStore.find('conversations', { participants: uid }).sort(byTime('created_at')).reverse();
  },
  async getConversation(id) {
    if (useMongo()) {
      try { return plain(await Conversation.findById(id)); } catch (e) { return null; }
    }
    return fallbackStore.findById('conversations', id);
  },
  async findOrCreateConversation(participants, carId) {
    const parts = participants.map(String).sort();
    const existing = (await this.listConversations(parts[0])).find(c =>
      c.participants.map(String).sort().join() === parts.join() &&
      String(c.car_id || '') === String(carId || ''));
    if (existing) return { conversation: existing, created: false };
    if (useMongo()) {
      return { conversation: plain(await Conversation.create({ participants: parts, car_id: carId || undefined })), created: true };
    }
    return { conversation: fallbackStore.insert('conversations', { participants: parts, car_id: carId || null }), created: true };
  },
  async listMessages(conversationId) {
    if (useMongo()) return (await Message.find({ conversation_id: conversationId }).sort({ timestamp: 1 })).map(plain);
    return fallbackStore.find('messages', { conversation_id: conversationId }).sort(byTime('timestamp'));
  },
  async addMessage(m) {
    if (useMongo()) return plain(await Message.create(m));
    return fallbackStore.insert('messages', m);
  },
  async lastMessage(conversationId) {
    const all = await this.listMessages(conversationId);
    return all.length ? all[all.length - 1] : null;
  }
};

// ── Reviews ──────────────────────────────────────────────────────────────────
const reviews = {
  async list(carId) {
    if (useMongo() && Review) return (await Review.find({ car_id: Number(carId) }).sort({ timestamp: -1 })).map(plain);
    return fallbackStore.find('reviews', { car_id: carId }).sort(byTime('timestamp')).reverse();
  },
  async create(r) {
    if (useMongo() && Review) return plain(await Review.create(Object.assign({}, r, { car_id: Number(r.car_id) })));
    return fallbackStore.insert('reviews', Object.assign({}, r, { car_id: Number(r.car_id) }));
  }
};

// ── Activity feed ────────────────────────────────────────────────────────────
const activity = {
  async list(userId, limit = 50) {
    const uid = String(userId);
    if (useMongo() && Activity) return (await Activity.find({ user_id: uid }).sort({ timestamp: -1 }).limit(limit)).map(plain);
    return fallbackStore.find('activities', { user_id: uid }).sort(byTime('timestamp')).reverse().slice(0, limit);
  },
  /** Fire-and-forget: never let a feed failure break the main request. */
  async record(userId, type, refId, data) {
    try {
      const doc = { user_id: String(userId), type, ref_id: refId == null ? undefined : String(refId), data };
      if (useMongo() && Activity) await Activity.create(doc);
      else fallbackStore.insert('activities', doc);
    } catch (e) { console.warn('[activity] could not record event:', e.message); }
  }
};

module.exports = { chat, reviews, activity };
