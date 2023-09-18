// models/Book.js
const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
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

const Book = mongoose.model('Book', bookSchema);

module.exports = Book;
