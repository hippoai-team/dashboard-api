const mongoose = require('mongoose');


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
  
  module.exports = mongoose.model('BackendChatLog', BackendChatLogSchema, 'chat_logs');
  