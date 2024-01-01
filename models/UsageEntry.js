const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI_2, {
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

const UsageEntry = mongoose.model('usage', UsageEntrySchema);