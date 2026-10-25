/**
 * models/mongo/activity.model.js
 * Activity feed events — new_offer, offer_accepted, message_received, offer_rejected.
 */
'use strict';
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user_id:   { type: String, required: true },
  type:      {
    type: String,
    enum: ['new_offer','offer_accepted','offer_rejected','message_received','booking_requested','booking_confirmed','booking_cancelled','order_updated'],
    required: true
  },
  ref_id:    { type: String },           // reference entity id
  data:      { type: mongoose.Schema.Types.Mixed }, // flexible extra data
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Activity', activitySchema);
