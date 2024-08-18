const mongoose = require('mongoose');

const chatLogSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    date: String,
    time: String,
    datetime: Date,
    thread_uuid: String,
    thread_status: Boolean,
    email: String,
    uuid: String,
    query: String,
    response: String,
    chat_history: Array,
    sources: Array,
});

const ChatLog = mongoose.model('chat_log', chatLogSchema);

module.exports = ChatLog;