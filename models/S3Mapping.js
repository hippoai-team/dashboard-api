const mongoose = require('mongoose');

const S3MappingSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    s3_key: String,
    mongodb_id: String,
});

const S3Mapping = mongoose.model('S3Mapping', S3MappingSchema, 's3_mapping');

module.exports = S3Mapping;