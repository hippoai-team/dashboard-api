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
  role: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: 'active'
  },
});

module.exports = mongoose.model('users', userSchema);

