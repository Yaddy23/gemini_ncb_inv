const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  ISBN: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  SUBJECT: {
    type: String,
    trim: true
  },
  TITLE: {
    type: String,
    required: true,
    trim: true
  },
  EDITION: {
    type: String,
    trim: true
  },
  YEAR: {
    type: String,
    trim: true
  },
  AUTHOR: {
    type: String,
    trim: true
  },
  BIND: {
    type: String,
    trim: true
  },
  QTY: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  PRICE: {
    type: Number,
    required: true,
    default: 0.00,
    min: 0
  },
  MIN_QTY: {
    type: Number,
    default: 5,
    min: 0
  },
  PUBLISHER: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster searching
bookSchema.index({ TITLE: 'text', AUTHOR: 'text', SUBJECT: 'text', PUBLISHER: 'text' });

module.exports = mongoose.model('Book', bookSchema);