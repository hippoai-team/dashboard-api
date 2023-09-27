// models/Source.js
const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
  topic: String,
  category: String,
  subspecialty: String,
  title: String,
  publisher: String,
  year: Number,
  source: String,
  status: String,
  is_paid: Boolean,
  load_type: String,
  patient_population: String,
  source_type: String,
  ids: [String],
  isDeleted: { type: Boolean, default: false },
  date_added: {
    type: Date,
    default: Date.now,
  },
  date_modified: {
    type: Date,
    default: Date.now,
  },
});

const Source = mongoose.model('Source', sourceSchema);

module.exports = Source;
