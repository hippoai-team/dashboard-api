const mongoose = require('mongoose');
//config dotenv


const UsageEntrySchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
    },
    api_key: String,
    input_count: Number,
    output_count: Number,
    model: String,
});

const UsageEntry = mongoose.model('usage_entry', UsageEntrySchema, 'usage');

module.exports = UsageEntry;