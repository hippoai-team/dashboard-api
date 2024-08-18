
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  thread_uuid: {
    type: String,
    required: true
  },
  uuid: {
    type: String,
    required: true
  },
  feedback: {
    inaccurateInformation: {
      type: Boolean,
      default: false
    },
    inaccurateSources: {
      type: Boolean,
      default: false
    },
    notRelevant: {
      type: Boolean,
      default: false
    },
    hallucinations: {
      type: Boolean,
      default: false
    },
    outdated: {
      type: Boolean,
      default: false
    },
    tooLengthy: {
      type: Boolean,
      default: false
    },
    formatting: {
      type: Boolean,
      default: false
    },
    missing: {
      type: Boolean,
      default: false
    },
    other: {
      type: String,
      default: ""
    }
  },
  isLiked: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Feedback', feedbackSchema, 'user_feedbacks');
