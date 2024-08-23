const mongoose = require('mongoose');

const featureInteractionSchema = new mongoose.Schema({
  thread_uuid: String,
  email: String,
  timestamp: Date,
  interaction: Object
}, { timestamps: true });

const FeatureInteraction = mongoose.model('FeatureInteraction', featureInteractionSchema,'feature_interactions');

module.exports = FeatureInteraction;