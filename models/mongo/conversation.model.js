/**
 * models/mongo/conversation.model.js
 * Stores dealer-buyer chat conversations.
 */
'use strict';
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: String, required: true }], // user IDs as strings
  car_id:       { type: Number },
  created_at:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversation', conversationSchema);
