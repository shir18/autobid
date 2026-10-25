/**
 * routes/chat.routes.js
 * Live dealer ↔ buyer chat (MongoDB, or the file fallback store when Mongo is down).
 * Every route requires login and checks that you are a participant of the conversation.
 */
'use strict';
const express  = require('express');
const router   = express.Router();
const pool     = require('../db');
const { chat, activity } = require('../services/store');
const { authenticate }   = require('../middleware/auth');
const { httpError }      = require('../services/helpers');

router.use(authenticate);

/** Adds participant names + car label so the UI can show "Chat with AutoBid Delhi North · Hyundai Creta". */
async function enrich(convs) {
  const ids = [...new Set(convs.flatMap(c => c.participants.map(Number)).filter(Boolean))];
  let users = [];
  if (ids.length) {
    [users] = await pool.query(`SELECT id, name, role FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  }
  const carIds = [...new Set(convs.map(c => Number(c.car_id)).filter(Boolean))];
  let cars = [];
  if (carIds.length) {
    [cars] = await pool.query(`
      SELECT c.id, b.name AS brand_name, m.name AS model_name, v.name AS variant_name
      FROM cars c JOIN variants v ON v.id = c.variant_id JOIN models m ON m.id = v.model_id JOIN brands b ON b.id = m.brand_id
      WHERE c.id IN (${carIds.map(() => '?').join(',')})`, carIds);
  }
  const out = [];
  for (const c of convs) {
    const car = cars.find(x => x.id === Number(c.car_id));
    const last = await chat.lastMessage(c._id);
    out.push(Object.assign({}, c, {
      participant_info: c.participants.map(p => users.find(u => String(u.id) === String(p)) || { id: p, name: 'User ' + p }),
      car_label: car ? car.brand_name + ' ' + car.model_name + ' ' + car.variant_name : null,
      last_message: last ? { text: last.text, timestamp: last.timestamp } : null
    }));
  }
  // most recent activity first
  out.sort((a, b) => new Date((b.last_message || b).timestamp || b.created_at) - new Date((a.last_message || a).timestamp || a.created_at));
  return out;
}

async function assertParticipant(conversationId, userId) {
  const conv = await chat.getConversation(conversationId);
  if (!conv) throw httpError(404, 'Conversation not found');
  if (!conv.participants.map(String).includes(String(userId))) throw httpError(403, 'You are not part of this conversation');
  return conv;
}

// GET /api/chat/conversations  (and /conversations/:userId for compatibility)
router.get('/conversations', async (req, res, next) => {
  try { res.json(await enrich(await chat.listConversations(req.user.id))); } catch (err) { next(err); }
});
router.get('/conversations/:userId', async (req, res, next) => {
  try {
    if (String(req.params.userId) !== String(req.user.id)) throw httpError(403, 'You can only list your own conversations');
    res.json(await enrich(await chat.listConversations(req.user.id)));
  } catch (err) { next(err); }
});

// POST /api/chat/conversations { with_user_id, car_id? } — start (or reopen) a conversation
router.post('/conversations', async (req, res, next) => {
  try {
    const other = Number(req.body.with_user_id);
    if (!Number.isInteger(other) || other <= 0) throw httpError(400, 'with_user_id is required');
    if (other === Number(req.user.id)) throw httpError(400, 'You cannot chat with yourself');
    const [u] = await pool.query('SELECT id FROM users WHERE id = ?', [other]);
    if (!u.length) throw httpError(404, 'That user does not exist');

    const { conversation, created } = await chat.findOrCreateConversation([req.user.id, other], req.body.car_id ? Number(req.body.car_id) : null);
    const [enriched] = await enrich([conversation]);
    res.status(created ? 201 : 200).json(enriched);
  } catch (err) { next(err); }
});

// GET /api/chat/messages/:conversationId
router.get('/messages/:conversationId', async (req, res, next) => {
  try {
    await assertParticipant(req.params.conversationId, req.user.id);
    res.json(await chat.listMessages(req.params.conversationId));
  } catch (err) { next(err); }
});

// POST /api/chat/messages — send message (text, optional attachment_url, audio_flag)
router.post('/messages', async (req, res, next) => {
  try {
    const { conversation_id, attachment_url, audio_flag } = req.body;
    const text = String(req.body.text || '').trim();
    if (!conversation_id) throw httpError(400, 'conversation_id is required');
    if (!text && !attachment_url) throw httpError(400, 'Message cannot be empty');
    if (text.length > 2000) throw httpError(400, 'Message is too long');

    const conv = await assertParticipant(conversation_id, req.user.id);
    const doc = await chat.addMessage({
      conversation_id, sender_id: String(req.user.id), text,
      attachment_url: attachment_url || undefined, audio_flag: !!audio_flag
    });
    conv.participants.filter(p => String(p) !== String(req.user.id)).forEach(p =>
      activity.record(p, 'message_received', conversation_id, { message: 'New chat message: ' + text.slice(0, 60) }));
    res.status(201).json(doc);
  } catch (err) { next(err); }
});

module.exports = router;
