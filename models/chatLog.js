const mongoose = require('mongoose');

const chatLogSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    email: String,
    role: String,
    thread_uuid: String,
    chat_history: [
        {
            uuid: String,
            query: String,
            response: String,
            currentDate: String,
            currentTime: String,
            sources: [
                {
                    type: String,
                    status: String,
                    metadata: {
                        retrieval_tool_name: String,
                        event_type: String
                    },
                    message_uuid: String,
                    is_last_event: Boolean,
                    message: {
                        source_url: String,
                        title: String,
                        publisher: String,
                        date_published: String,
                        country: String,
                        province_state: String,
                        source_type: String,
                        content_type: String,
                        load_type: String,
                        access_status: String,
                        language: String,
                        peer_review_status: Boolean,
                        keywords: [String],
                        subject_specialty: String,
                        audience: String,
                        license: String,
                        source_id: String,
                        source_number: Number,
                        content: String
                    },
                    node_info: mongoose.Schema.Types.Mixed
                }
            ]
        }
    ],
    isDeleted: Boolean,
    created_at: Date,
    updated_at: Date
});

const ChatLog = mongoose.model('chat_log', chatLogSchema, 'chat_logs_hippo');

module.exports = ChatLog;