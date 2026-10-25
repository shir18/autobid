/**
 * models/mongo/message.model.js
 * Chat messages — variable shape (text, attachment, audio flag).
 * This flexible schema is why MongoDB is used here instead of MySQL.
 */
'use strict';
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender_id:       { type: String, required: true },
  text:            { type: String },
  attachment_url:  { type: String },   // optional file attachment
  audio_flag:      { type: Boolean, default: false }, // marks voice message
  read:            { type: Boolean, default: false },
  timestamp:       { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
