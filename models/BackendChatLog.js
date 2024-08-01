const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

pendium_db = mongoose.createConnection(process.env.MONGO_URL_2, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});


const BackendChatLogSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    datetime: Date,
    question: String,
    answer: String,
    chat_history: [[String]],
    filters: {
      source_type: {
        $in: [String]
      }
    },
    api_key: String,
    response_mode: String
  });
  
  module.exports = pendium_db.model('BackendChatLog', BackendChatLogSchema, 'chat_logs');
  