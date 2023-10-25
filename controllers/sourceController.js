// controllers/SourceController.js
const axios = require('axios');

const Source = require("../models/Source");
const PIPELINE_API_URL = process.env.PIPELINE_API_URL || "http://15.222.245.200:5000";
exports.store = async (req, res) => {
  try {
    const sourceData = req.body;
    console.log(sourceData);
    // Validate fields

    if (!sourceData.subspecialty || typeof sourceData.subspecialty !== "string") {
      console.log('error, invalid subspecialty', sourceData.subspecialty);
      return res.status(400).json({ error: "Invalid subspecialty" });
    }

    if (!sourceData.title || typeof sourceData.title !== "string") {
      console.log('error, invalid title', sourceData.title);
      return res.status(400).json({ error: "Invalid title" });
    }

    if (!sourceData.publisher || typeof sourceData.publisher !== "string") {
      console.log('error, invalid publisher', sourceData.publisher);
      return res.status(400).json({ error: "Invalid publisher" });
    }

    if (!sourceData.source || typeof sourceData.source !== "string") {
      console.log('error, invalid source', sourceData.source);
      return res.status(400).json({ error: "Invalid source" });
    }
    const existingSource = await Source.findOne({ source: sourceData.source });
    if (existingSource) {
      console.log('error, source already exists', sourceData.source);
      return res.status(400).json({ error: "Source already exists" });
    }
    if (typeof sourceData.year !== "string" || !/^\d{4}$/.test(sourceData.year)) {
      console.log('error, invalid year', sourceData.year);
      return res.status(400).json({ error: "Invalid year" });
    }

    if (
      typeof sourceData.status !== "string"    
    ) {
      console.log('error, invalid status', sourceData.status);
      return res.status(400).json({ error: "Invalid status" });
    }

    if (typeof sourceData.is_paid !== "boolean") {
      console.log('error, invalid is_paid', sourceData.is_paid);
      return res.status(400).json({ error: "Invalid payment status" });
    }

    if (!sourceData.source_type || typeof sourceData.source_type !== "string") {
      console.log('error, invalid source_type', sourceData.source_type);
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
    const perPage = parseInt(req.query.perPage) || 10; // Get the requested number of items per page or default to 10

    // Calculate the skip value based on the requested page
    const skip = (page - 1) * perPage;

    // Initializing the search query to status == 'remove' or 'removed'
    let query = {}

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

    const statusFilter = req.query.status || "";
    if (statusFilter) {
      if (statusFilter) {
        query.status = statusFilter; // Add the status filter to the query object
    }
    }
    // Get distinct source types
    const allSourceTypes = await Source.distinct("source_type", query); // Exclude soft-deleted sources when fetching distinct source types

    // Get the number of sources for each type of status based on search or filter
    const statusTypes = [
      "indexed",
      "failed_index",
      "new",
      "remove",
      "index_deleted"
    ];
    const statusCounts = {};

    for (const status of statusTypes) {
      statusCounts[status] = await Source.countDocuments({ ...query, status });
    }

    const sourceTypeCounts = {};
    for (const sourceType of allSourceTypes) {
      sourceTypeCounts[sourceType] = await Source.countDocuments({ ...query, source_type: sourceType });
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
      sourceTypeCounts,
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
      { $set: { status: remove } }
    );

    
    const response = await axios.post(`${PIPELINE_API_URL}/process_ids`, { ids: sourceIds });
    //add source name to the response data
    console.log(response.data);
    

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
  console.log('update', req.body, req.params.id)
  try {
    const source = await Source.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!source) {
      console.log('update error', error)
      return res.status(404).json({ error: "Source not found" });
    }

    // Exclude date_added from the update
    source.date_added = source.date_added;

    // Update the date_modified field to the current date
    source.date_modified = new Date();
    await source.save();
    res.json(source);
  } catch (error) {
    console.log('update error', error)
    res.status(500).json({ error: "Failed to update source" });
  }
};

exports.destroy = async (req, res) => {
  try {
    const id = req.params.id; 
    const title = await Source.findOne({ _id: id }, { title: 1, _id: 0 });

    await Source.updateOne({ _id: req.params.id }, { status: 'remove' });
    
    const response = await axios.post(`${PIPELINE_API_URL}/process_ids`, { ids:[id] });
    console.log(response.data);
    
    res.status(200).send('Source soft deleted successfully');

  } catch (error) {
      res.status(500).send('Server error');
  }
  }


exports.process = async (req, res) => {
  const id = req.params.id;
  //find corresponding name using id in source collection
  const title = await Source.findOne({ _id: id }, { title: 1, _id: 0 });
  try {
    const response = await axios.post(`${PIPELINE_API_URL}/process_ids`, { ids:[id] });
    //add source name to the response data
    response.data.title = title.title
    res.status(200).json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process source" });
  }
  //add source name to the response data

};

exports.processMultiple = async (req, res) => {
  const { sourceIds } = req.body.data;
  //find corresponding title using ids in source collection
  const titles = await Source.find({ _id: { $in: sourceIds } }, { title: 1, _id: 1 });
  try {
    const response = await axios.post(`${PIPELINE_API_URL}/process_ids`, { ids: sourceIds });
    //add source name to the response data
    response.data.titles = titles
    res.status(200).json(response.data);
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process sources" });
  }

};