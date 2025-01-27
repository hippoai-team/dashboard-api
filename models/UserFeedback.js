const mongoose = require('mongoose');

const userFeedbackSchema = new mongoose.Schema({
    email: String,
    thread_uuid: String,
    uuid: String,
    feedback: {
        inaccurateInformation: Boolean,
        inaccurateSources: Boolean,
        notRelevant: Boolean,
        hallucinations: Boolean,
        outdated: Boolean,
        tooLengthy: Boolean,
        formatting: Boolean,
        missingSources: Boolean,
        other: String,
    },
    isLiked: Boolean
});

// Check if the model exists before creating it
const UserFeedback = mongoose.models.user_feedback || mongoose.model('user_feedback', userFeedbackSchema, 'user_feedbacks');

module.exports = UserFeedback;
