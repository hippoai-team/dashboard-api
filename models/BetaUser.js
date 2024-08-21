// models/Source.js
const mongoose = require('mongoose');
//show all process env

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
    invite_sent: {
      type: Boolean,
      default: false,
    },
    


});

const BetaUser = mongoose.model('betauser', betaUserSchema, 'beta_emails');

module.exports = BetaUser;
