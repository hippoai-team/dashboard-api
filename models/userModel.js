// models/Book.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: null
  },
  profession: {
    type: String,
    default: null
  },
  newsletter: {
    type: Boolean,
    default: null
  },
  sources: {
    type: Array,
    default: []
  },
  permissions: {
    type: Array,
    default: []
  },
  signup_date: {
    type: Date,
    default: null
  },
  num_logins: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: 'active'
  },
  usage: {
    type: Number,
    default: 0
  },
  feedback_count: {
    type: Number,
    default: 0
  },
  follow_up_usage: {
    type: Number,
    default: 0
  },
  clicked_sources: {
    type: Array,
    default: []
  },
  sourceClickCount: {
    type: Number,
    default: 0
  },
  nav_threads: {
    type: Number,
    default: 0
  },
  nav_saved_sources: {
    type: Number,
    default: 0
  },
  role: {
    type: String,
    default: 'user'
  },
});

module.exports = mongoose.model('users', userSchema);

