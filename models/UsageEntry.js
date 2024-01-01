const mongoose = require('mongoose');
//config dotenv
const dotenv = require('dotenv');
dotenv.config();
pendium_db = mongoose.createConnection(process.env.MONGO_URL_2, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const UsageEntrySchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
    },
    api_key: String,
    input_count: Number,
    output_count: Number,
});

const UsageEntry = pendium_db.model('usage_entry', UsageEntrySchema, 'usage');

module.exports = UsageEntry;