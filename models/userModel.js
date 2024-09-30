// models/userModel.js
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
  role: {
    type: String,
    default: 'user'
  },
  stripeCustomerId: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model('users', userSchema);
