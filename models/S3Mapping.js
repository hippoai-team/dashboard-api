const mongoose = require('mongoose');
pendium_db = mongoose.createConnection(process.env.MONGO_URL_2, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const S3MappingSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    s3_key: String,
    mongodb_id: String,
});

const S3Mapping = pendium_db.model('S3Mapping', S3MappingSchema, 's3_mapping');

module.exports = S3Mapping;