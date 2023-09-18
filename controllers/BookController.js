// controllers/BookController.js

const Book = require("../models/Book");

exports.store = async (req, res) => {
  try {
    const bookData = req.body;

    // Validate fields
    if (!bookData.topic || typeof bookData.topic !== "string") {
      return res.status(400).json({ error: "Invalid topic" });
    }

    if (!bookData.category || typeof bookData.category !== "string") {
      return res.status(400).json({ error: "Invalid category" });
    }

    if (!bookData.subspecialty || typeof bookData.subspecialty !== "string") {
      return res.status(400).json({ error: "Invalid subspecialty" });
    }

    if (!bookData.title || typeof bookData.title !== "string") {
      return res.status(400).json({ error: "Invalid title" });
    }

    if (!bookData.publisher || typeof bookData.publisher !== "string") {
      return res.status(400).json({ error: "Invalid publisher" });
    }

    if (!bookData.source || typeof bookData.source !== "string") {
      return res.status(400).json({ error: "Invalid source" });
    }

    if (typeof bookData.year !== "string" || !/^\d{4}$/.test(bookData.year)) {
      return res.status(400).json({ error: "Invalid year" });
    }

    if (
      typeof bookData.status !== "string" &&
      bookData.status !== "New" /* && other statuses here*/
    ) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (typeof bookData.is_paid !== "string") {
      return res.status(400).json({ error: "Invalid payment status" });
    }

    if (!bookData.load_type || typeof bookData.load_type !== "string") {
      return res.status(400).json({ error: "Invalid load type" });
    }

    if (
      !bookData.patient_population ||
      typeof bookData.patient_population !== "string"
    ) {
      return res.status(400).json({ error: "Invalid patient population" });
    }

    if (!bookData.source_type || typeof bookData.source_type !== "string") {
      return res.status(400).json({ error: "Invalid source type" });
    }

    // Create a new Book instance and save it
    const book = new Book(bookData);
    book.date_added = new Date();
    book.date_modified = new Date();
    await book.save();

    res.status(201).json(book);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(400).json({ error: "Failed to create book" });
  }
};

exports.index = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get the requested page or default to page 1
    const perPage = 5;

    // Calculate the skip value based on the requested page
    const skip = (page - 1) * perPage;

    // Initializing the search query to exclude soft-deleted books
    let query = { isDeleted: { $ne: true } };

    // Handle text search
    const search = req.query.search || "";
    if (search) {
      const regexSearch = { $regex: search, $options: "i" };

      const searchQueries = [
        { topic: regexSearch },
        { category: regexSearch },
        { subspecialty: regexSearch },
        { title: regexSearch },
        { publisher: regexSearch },
      ];

      if (!isNaN(search)) {
        searchQueries.push({ year: parseInt(search) });
      }

      query.$or = searchQueries;
    }

    // Handle source type filtering
    const sourceTypeFilter = req.query.source_type || "";
    if (sourceTypeFilter) {
      query.source_type = sourceTypeFilter; // Add the source_type filter to the query object
    }

    // Get distinct source types
    const allSourceTypes = await Book.distinct("source_type", query); // Exclude soft-deleted books when fetching distinct source types

    // Get the number of books for each type of status based on search or filter
    const statusTypes = [
      "indexed",
      "failed_index",
      "failed_download",
      "failed_load",
      "New",
    ];
    const statusCounts = {};

    for (const status of statusTypes) {
      statusCounts[status] = await Book.countDocuments({ ...query, status });
    }

    // Find the total number of documents matching the query
    const totalBooks = await Book.countDocuments(query);

    // Query for books with pagination and sorting
    const books = await Book.find(query)
      .sort({ date_modified: -1 })
      .skip(skip)
      .limit(perPage)
      .exec();

    const data = {
      books,
      totalBooks,
      currentPage: page,
      statusCounts,
      totalPages: Math.ceil(totalBooks / perPage),
      allSourceTypes,
      sourceTypeFilter,
    };

    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch books" });
  }
};

exports.deleteMultiple = async (req, res) => {
  const { bookIds } = req.body;


  try {
    const result = await Book.updateMany(
      { _id: { $in: bookIds } },
      { $set: { isDeleted: true } }
    );

    if (result.nModified > 0) {
      res.status(200).json({ message: "Selected books soft deleted successfully."});
    } else {
      res.status(200).json({ message: "No books were modified. They might already be deleted or not found." });
    }

  } catch (error) {
    res.status(500).json({ error: `Failed to soft delete selected books: ${error.message}` });
  }
};


exports.show = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }
    res.json(book);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch book" });
  }
};

exports.update = async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    // Exclude date_added from the update
    book.date_added = book.date_added;

    // Update the date_modified field to the current date
    book.date_modified = new Date();
    await book.save();
    res.json(book);
  } catch (error) {
    res.status(500).json({ error: "Failed to update book" });
  }
};

exports.destroy = async (req, res) => {
  try {
    await Book.updateOne({ _id: req.params.id }, { isDeleted: true });
    res.status(200).send('Book soft deleted successfully');
  } catch (error) {
      res.status(500).send('Server error');
  }
};
