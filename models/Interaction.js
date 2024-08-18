const mongoose = require('mongoose');

const interactionSchema = new mongoose.Schema({
  thread_uuid: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  interaction: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  __v: {
    type: Number,
    select: false
  }
});

module.exports = mongoose.model('Interaction', interactionSchema, 'feature_interactions');

