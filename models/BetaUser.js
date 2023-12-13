// models/Source.js
const mongoose = require('mongoose');

const betaUserSchema = new mongoose.Schema({
    name: String,
    invite_sent: Boolean,
  email: String,
  usage: Number,
  status: String,
  profession: String,
  cohort: String,
    date_added: {
        type: Date,
        default: Date.now,
    },
    source: {
      type: String,
      default: 'dashboard',
    },


});

const BetaUser = mongoose.model('betauser', betaUserSchema);

module.exports = BetaUser;
