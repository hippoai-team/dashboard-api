// models/Source.js
const mongoose = require('mongoose');

const betaUserSchema = new mongoose.Schema({
  email: String,
  status: String,
    date_added: {
        type: Date,
        default: Date.now,
    },

});

const BetaUser = mongoose.model('betauser', betaUserSchema);

module.exports = BetaUser;
