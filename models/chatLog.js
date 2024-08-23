const mongoose = require('mongoose');

const chatLogSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    date: String,
    time: String,
    datetime: Date,
    role: String,
    thread_uuid: String,
    chat_history: [
        {
            uuid: String,
            query: String,
            response: String,
            currentDate: String,
            currentTime: String,
            sources: Array,
            tokenSummary: Object
        }
    ],
    isDeleted: Boolean,
    created_at: Date,
    updated_at: Date
});

const ChatLog = mongoose.model('chat_log', chatLogSchema, 'chat_logs_hippo');

module.exports = ChatLog;