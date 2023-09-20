// controllers/SourceController.js

const Source = require("../models/Source");

exports.store = async (req, res) => {
  try {
    const sourceData = req.body;
    console.log(sourceData);
    // Validate fields
    if (!sourceData.topic || typeof sourceData.topic !== "string") {
      return res.status(400).json({ error: "Invalid topic" });
    }

    if (!sourceData.category || typeof sourceData.category !== "string") {
      return res.status(400).json({ error: "Invalid category" });
    }

    if (!sourceData.subspecialty || typeof sourceData.subspecialty !== "string") {
      return res.status(400).json({ error: "Invalid subspecialty" });
    }

    if (!sourceData.title || typeof sourceData.title !== "string") {
      return res.status(400).json({ error: "Invalid title" });
    }

    if (!sourceData.publisher || typeof sourceData.publisher !== "string") {
      return res.status(400).json({ error: "Invalid publisher" });
    }

    if (!sourceData.source || typeof sourceData.source !== "string") {
      return res.status(400).json({ error: "Invalid source" });
    }

    if (typeof sourceData.year !== "string" || !/^\d{4}$/.test(sourceData.year)) {
      return res.status(400).json({ error: "Invalid year" });
    }

    if (
      typeof sourceData.status !== "string" &&
      sourceData.status !== "New" /* && other statuses here*/
    ) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (typeof sourceData.is_paid !== "string") {
      return res.status(400).json({ error: "Invalid payment status" });
    }

    if (!sourceData.load_type || typeof sourceData.load_type !== "string") {
      return res.status(400).json({ error: "Invalid load type" });
    }

    if (
      !sourceData.patient_population ||
      typeof sourceData.patient_population !== "string"
    ) {
      return res.status(400).json({ error: "Invalid patient population" });
    }

    if (!sourceData.source_type || typeof sourceData.source_type !== "string") {
      return res.status(400).json({ error: "Invalid source type" });
    }

    // Create a new Source instance and save it
    const source = new Source(sourceData);
    source.date_added = new Date();
    source.date_modified = new Date();
    await source.save();

    res.status(201).json(source);
  } catch (error) {
    if (error.name === "ValidationError") {
      console.log('error', error);
      return res.status(400).json({ error: error.message });
    }
    console.log('error', error);
    res.status(400).json({ error: "Failed to create source" });
    
  }
};

exports.index = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get the requested page or default to page 1
    const perPage = 5;

    // Calculate the skip value based on the requested page
    const skip = (page - 1) * perPage;

    // Initializing the search query to exclude soft-deleted sources
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
    const allSourceTypes = await Source.distinct("source_type", query); // Exclude soft-deleted sources when fetching distinct source types

    // Get the number of sources for each type of status based on search or filter
    const statusTypes = [
      "indexed",
      "failed_index",
      "failed_download",
      "failed_load",
      "New",
    ];
    const statusCounts = {};

    for (const status of statusTypes) {
      statusCounts[status] = await Source.countDocuments({ ...query, status });
    }

    // Find the total number of documents matching the query
    const totalSources = await Source.countDocuments(query);

    // Query for sources with pagination and sorting
    const sources = await Source.find(query)
      .sort({ date_modified: -1 })
      .skip(skip)
      .limit(perPage)
      .exec();

    const data = {
      sources,
      totalSources,
      currentPage: page,
      statusCounts,
      totalPages: Math.ceil(totalSources / perPage),
      allSourceTypes,
      sourceTypeFilter,
    };

    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch sources" });
  }
};

exports.deleteMultiple = async (req, res) => {
  const { sourceIds } = req.body;


  try {
    const result = await Source.updateMany(
      { _id: { $in: sourceIds } },
      { $set: { isDeleted: true } }
    );

    if (result.nModified > 0) {
      res.status(200).json({ message: "Selected sources soft deleted successfully."});
    } else {
      res.status(200).json({ message: "No sources were modified. They might already be deleted or not found." });
    }

  } catch (error) {
    res.status(500).json({ error: `Failed to soft delete selected sources: ${error.message}` });
  }
};


exports.show = async (req, res) => {
  try {
    const source = await Source.findById(req.params.id);
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }
    res.json(source);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch source" });
  }
};

exports.update = async (req, res) => {
  try {
    const source = await Source.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }

    // Exclude date_added from the update
    source.date_added = source.date_added;

    // Update the date_modified field to the current date
    source.date_modified = new Date();
    await source.save();
    res.json(source);
  } catch (error) {
    res.status(500).json({ error: "Failed to update source" });
  }
};

exports.destroy = async (req, res) => {
  try {
    await Source.updateOne({ _id: req.params.id }, { isDeleted: true });
    res.status(200).send('Source soft deleted successfully');
  } catch (error) {
      res.status(500).send('Server error');
  }
};
