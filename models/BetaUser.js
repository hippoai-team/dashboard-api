// models/Source.js
const mongoose = require('mongoose');
MONGO_URL_2='mongodb+srv://omrinach:Omri4438@summari.ugwoxib.mongodb.net/pendium_db'

pendium_db = mongoose.createConnection(MONGO_URL_2, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

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

const BetaUser = pendium_db.model('betauser', betaUserSchema, 'betausers');

module.exports = BetaUser;
