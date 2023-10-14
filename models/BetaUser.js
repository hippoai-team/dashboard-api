// models/Source.js
const mongoose = require('mongoose');

const betaUserSchema = new mongoose.Schema({
    name: String,
  email: String,
  usage: Integer,
  status: String,
    date_added: {
        type: Date,
        default: Date.now,
    },


});

const BetaUser = mongoose.model('betauser', betaUserSchema);

module.exports = BetaUser;
