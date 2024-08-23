const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  inaccurateInformation: { type: Boolean, default: false },
  inaccurateSources: { type: Boolean, default: false },
  notRelevant: { type: Boolean, default: false },
  hallucinations: { type: Boolean, default: false },
  outdated: { type: Boolean, default: false },
  tooLengthy: { type: Boolean, default: false },
  formatting: { type: Boolean, default: false },
  missingSources: { type: Boolean, default: false },
  other: { type: String, default: '' }
});

const userFeedbackSchema = new mongoose.Schema({
  email: { type: String, required: true },
  thread_uuid: { type: String, required: true },
  uuid: { type: String, required: true },
  feedback: feedbackSchema,
  isLiked: { type: Boolean, default: false }
}, { timestamps: true });

const UserFeedback = mongoose.model('UserFeedback', userFeedbackSchema,'user_feedbacks');

module.exports = UserFeedback;
