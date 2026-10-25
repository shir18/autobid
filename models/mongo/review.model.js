/**
 * models/mongo/review.model.js
 * Car reviews — stored in MongoDB for flexible schema (pros/cons lists, etc.).
 */
'use strict';
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  car_id:    { type: Number, required: true },
  user_id:   { type: String, required: true },
  user_name: { type: String },
  rating:    { type: Number, min: 1, max: 5, required: true },
  title:     { type: String },
  body:      { type: String },
  pros:      [{ type: String }],
  cons:      [{ type: String }],
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', reviewSchema);
