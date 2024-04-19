// controllers/SourceController.js
const axios = require('axios');
const mongoose = require('mongoose');
const { createNewSourceModel, createNewMasterSourceModel } = require('../models/NewSource');
const clinical_guidelines_master = createNewSourceModel('clinical_guidelines_master');
const review_articles_master = createNewSourceModel('review_articles_master');
const formulary_lists_master = createNewSourceModel('formulary_lists_master');
const drug_monographs_master = createNewSourceModel('drug_monograph_master');
const newMasterSource = createNewMasterSourceModel('master_sources');

const source_type_list = {
    'clinical_guidelines': clinical_guidelines_master,
    'review_articles': review_articles_master,
    'formulary_lists': formulary_lists_master,
    'drug_monographs': drug_monographs_master
}

//const PIPELINE_API_URL = process.env.PIPELINE_API_URL || "http://15.222.26.222:8080";
const PIPELINE_API_URL = 'http://127.0.0.1:8000';
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
      const tab = parseInt(req.query.active_tab); // Convert active_tab to integer to use in logic
  
      const skip = (page - 1) * perPage; // Calculate the skip value based on the requested page
  
      // Initializing the base query
      let query = {};
  
      // Handling text search universally for both tabs
      const search = req.query.search || "";
      if (search) {
        const regexSearch = { $regex: search, $options: "i" };
        let searchQueries = [
          { title: regexSearch },
          { publisher: regexSearch },
          { subspecialty: regexSearch }
        ];
  
        // Adjusting search fields based on tab, assuming different data structures for master sources
        if (tab === 1) { // Assume tab 1 is for master sources with different document structure
          searchQueries = [
            { 'metadata.title': regexSearch },
            { 'metadata.publisher': regexSearch },
            { 'metadata.subspecialty': regexSearch }
          ];
        }
        query.$or = searchQueries;
      }
  
      // Handle source type filtering based on tab
      let sourceType = req.query.source_type;
      if (tab === 0 && !sourceType) { // For tab 0, default to the first source type if not provided
        sourceType = Object.keys(source_type_list)[0];
        query.source_type = sourceType;
      } else if (sourceType) {
        if (tab === 0) { // Sources
          query.source_type = sourceType;
        } else { // Master Sources, assuming different data structure
          query['metadata.source_type'] = sourceType;
        }
      }
  
      // Fetch data based on tab selection
      let sources, master_sources, total_source_counts;
      if (tab === 0) { // Fetching regular sources
        sources = await source_type_list[sourceType].find(query).skip(skip).limit(perPage);
        total_source_counts = { sources: await source_type_list[sourceType].countDocuments(query) };
      } else { // Fetching master sources
        master_sources = await newMasterSource.find(query, 'metadata processed id_').skip(skip).limit(perPage).lean();

        // Add the processed field to the metadata of master sources
        master_sources = master_sources.map(doc => {
          doc.metadata.processed = doc.processed;
          //adding the _id tag for checkbox filtering on the dashboard to keep it consistent.
          doc.metadata._id = doc._id;
          return doc.metadata;
        });

        total_source_counts = { master_sources: await newMasterSource.countDocuments(query) };
      }
  
      // Constructing the response data structure
      const data = {
        sources: tab === 0 ? sources : [],
        master_sources: tab === 1 ? master_sources : [],
        source_types: Object.keys(source_type_list), // Assuming this list is defined globally or imported
        total_source_counts
      };
  
      res.json(data); // Sending the constructed data as response
    } catch (error) {
      console.error("Error in fetching sources:", error);
      res.status(500).json({ error: "Failed to fetch sources due to server error" });
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


exports.approve = async (req, res) => {
  const { sourceId, sourceType } = req.body;
  console.log('approve', sourceId, sourceType)
  var source_metadata = await source_type_list[sourceType].findOne({ _id: sourceId });
  if (!source_metadata) {
    return res.status(404).json({ error: "Source not found" });
  }
  
  // Add the id as a param field to the source_metadata
  source_metadata.set('source_id', sourceId);

    //create new master source instance with the source metadata
    const masterSource = new newMasterSource({
        _id: new mongoose.Types.ObjectId(sourceId),
        metadata: source_metadata,
        source_id: sourceId
    })
    //save the master source
    await masterSource.save();
  res.status(200).json({ message: "Source approved successfully", data: { title: source_metadata.title } });
};

exports.approveMultiple = async (req, res) => {
  const { sourceIds, sourceType } = req.body;
  try {
    const sources_metadata = await source_type_list[sourceType].find({ _id: { $in: sourceIds } });
    if (sources_metadata.length !== sourceIds.length) {
      return res.status(404).json({ error: "One or more sources not found" });
    }
    const masterSources = sources_metadata.map(metadata => {
      const source_id = metadata._id;
      metadata.set('source_id', source_id);
      delete metadata._id;
      return new newMasterSource({
        metadata: metadata,
        source_id: source_id,
      });
    });
    for (const masterSource of masterSources) {
      await masterSource.save();
    }
    res.status(200).json({ message: "Sources approved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to approve sources" });
  }
};

exports.process = async (req, res) => {
  const { sourceId } = req.body;
  try {
    const response = await axios.post(`${PIPELINE_API_URL}/ingest`, { document_ids: [sourceId] });
    res.status(200).json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

exports.processMultiple = async (req, res) => {
  const { sourceIds } = req.body;
  try {
    const response = await axios.post(`${PIPELINE_API_URL}/ingest`, { document_ids: sourceIds });
    res.status(200).json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process sources" });
  }
}

exports.getPipelineStatus = async (req, res) => {
  try {
    const response = await axios.get(`${PIPELINE_API_URL}/status`);
    res.status(200).json(response.data);
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
      res.status(200).json({status: 'unavailable', error: "Pipeline API is unavailable"});
    } else {
      res.status(500).json({ error: "Failed to get pipeline status" });
    }
  }
}