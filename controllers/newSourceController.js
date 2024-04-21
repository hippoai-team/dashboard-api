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
  const sources = req.body.sources; // Assuming sources is an array of source data
  console.log('sources', sources);
  if (!sources || !Array.isArray(sources)) {
    return res.status(400).send({ error: 'Invalid input' });
  }

  let createdSources = [];
  let sourceCreationStatus = [];

  for (const sourceData of sources) {
    try {
      // Check if source URL already exists
      const existingSource = await newMasterSource.findOne({ 'metadata.source_url': sourceData.source_url });
      if (existingSource) {
        sourceCreationStatus.push({ source_url: sourceData.source_url, source_title: sourceData.title, status: 'exists' });
        continue; // Skip to the next sourceData if this URL already exists
      }

      // Create a new source object
      const id = new mongoose.Types.ObjectId();
      const newSource = new newMasterSource({
        _id: id,
        metadata: { ...sourceData, source_id: id.toString() }, // Store all form data in metadata, including the mongoose id
        source_id: id.toString()
      });

      // Save to MongoDB
      const createdSource = await newSource.save();
      createdSources.push(createdSource);
      sourceCreationStatus.push({ source_url: sourceData.source_url, source_title: sourceData.title, status: 'created' });
    } catch (error) {
      console.error(error);
      sourceCreationStatus.push({ source_url: sourceData.source_url, source_title:sourceData.title, status: 'error', error: error.message });
    }
  }

  res.status(201).json({ createdSources, sourceCreationStatus });
};




exports.index = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.perPage) || 10;
      const tab = parseInt(req.query.active_tab);

      const skip = (page - 1) * perPage;
      const search = req.query.search || "";
      const sourceType = req.query.source_type || "";
      const status = req.query.status || "";
      let query = {};

      // Universal search setup, adjusting fields based on active tab
      const baseSearch = { $regex: search, $options: "i" };
      const searchQueries = tab === 1 ? [
          { 'metadata.title': baseSearch },
          { 'metadata.publisher': baseSearch },
          { 'metadata.subspecialty': baseSearch }
      ] : [
          { title: baseSearch },
          { publisher: baseSearch },
          { subspecialty: baseSearch }
      ];

      if (search) {
          query.$or = searchQueries;
      }

      // Filtering by source type and status
      if (tab === 0) {
          query.source_type = sourceType || Object.keys(source_type_list)[0];
          if (status) {
              if (status === 'pending') {
                  query.$or = [{ status: { $exists: false } }, { status: 'pending' }];
              } else {
                  query.status = status;
              }
          } else {
              query.$or = [{ status: { $exists: false } }, { status: 'pending' }];
          }
      } else {
          if (sourceType) {
              query['metadata.source_type'] = sourceType;
          }
          if (status) {
              if (status === 'processed') {
                  query.processed = true;
              } else {
                  query.status = status;
                  query.processed = false;
              }
          }
      }

      // Fetching data based on tab selection
      let sources, master_sources, total_source_counts;
      if (tab === 0) {
          const effectiveSourceType = sourceType || Object.keys(source_type_list)[0];
          sources = await source_type_list[effectiveSourceType].find(query, null, { skip, limit: perPage });
          total_source_counts = { sources: await source_type_list[effectiveSourceType].countDocuments(query) };
      } else {
          master_sources = await newMasterSource.find(query, 'metadata processed id_', { skip, limit: perPage });
          master_sources = master_sources.map(doc => ({
              ...doc.metadata,
              processed: doc.processed,
              _id: doc._id  // Adding the _id tag for checkbox filtering
          }));
          total_source_counts = { master_sources: await newMasterSource.countDocuments(query) };
      }

      // Constructing the response data structure
      const data = {
          sources: tab === 0 ? sources : [],
          master_sources: tab === 1 ? master_sources : [],
          source_types: Object.keys(source_type_list),
          total_source_counts
      };

      res.json(data);
  } catch (error) {
      console.error("Error in fetching sources:", error);
      res.status(500).json({ error: "Failed to fetch sources due to server error" });
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
  const { sourceIds, sourceType } = req.body;
  const isSingleSource = !Array.isArray(sourceIds) || sourceIds.length === 1;
  const sourceIdArray = isSingleSource ? [sourceIds].flat() : sourceIds;

  try {
    const sources_metadata = await source_type_list[sourceType].find({ _id: { $in: sourceIdArray } });
    if (sources_metadata.length !== sourceIdArray.length) {
      return res.status(404).json({ error: "One or more sources not found" });
    }

    sources_metadata.forEach(metadata => {
      metadata.status = 'approved';
      metadata.reviewed_at = new Date();
      metadata.set('source_id', metadata._id);
    });

    await Promise.all(sources_metadata.map(metadata => metadata.save()));

    const statusReport = [];

    for (const metadata of sources_metadata) {
      const existingMasterSource = await newMasterSource.findOne({ 'metadata.source_url': metadata.source_url });
      if (existingMasterSource) {
        statusReport.push({
          url: metadata.source_url,
          title: metadata.title,
          status: 'exists'
        });
      } else {
        const masterSource = new newMasterSource({
          _id: new mongoose.Types.ObjectId(metadata._id),
          metadata: metadata,
          source_id: metadata._id,
          date_added: new Date()
        });
        await masterSource.save();
        statusReport.push({
          url: metadata.source_url,
          title: metadata.title,
          status: 'approved',
          timestamp: new Date()
        });
      }
    }

    const failedSources = statusReport.filter(report => report.status === 'failed').map(report => report.url);
    if (failedSources.length > 0) {
      return res.status(500).json({ error: "Failed to approve sources", failedSources });
    }

    res.status(200).json({ statusReport });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to approve sources" });
  }
};

exports.reject = async (req, res) => {
  const { sourceIds, sourceType } = req.body;
  try {
    const sources_metadata = await source_type_list[sourceType].find({ _id: { $in: sourceIds } });
    if (sources_metadata.length !== sourceIds.length) {
      return res.status(404).json({ error: "One or more sources not found" });
    }

    const statusReport = [];

    for (const metadata of sources_metadata) {
      metadata.status = 'rejected';
      metadata.reviewed_at = new Date();
      await metadata.save();
      statusReport.push({
        url: metadata.source_url,
        title: metadata.title,
        status: 'rejected',
        timestamp: new Date()
      });
    }

    const failedSources = statusReport.filter(report => report.status === 'failed').map(report => report.url);
    if (failedSources.length > 0) {
      return res.status(500).json({ error: "Failed to reject sources", failedSources });
    }

    res.status(200).json({ statusReport });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reject source(s)" });
  }
};

exports.process = async (req, res) => {
  const { sourceIds } = req.body;
  console.log(sourceIds)
  try {
    const response = await axios.post(`${PIPELINE_API_URL}/ingest`, { document_ids: sourceIds });
    res.status(200).json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}


exports.delete = async (req, res) => {
  
  const { sourceIds } = req.body;
  console.log(sourceIds)
  try {
    const response = await axios.post(`${PIPELINE_API_URL}/delete`, { document_ids: sourceIds });
    res.status(200).json({ message: "Source deleted successfully", data: response.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete source" });
  }
};



exports.getPipelineStatus = async (req, res) => {
  try {
    const response = await axios.get(`${PIPELINE_API_URL}/status`);
    console.log(response.data);
    res.status(200).json(response.data);
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
      res.status(200).json({status: 'unavailable', error: "Pipeline API is unavailable"});
    } else {
      res.status(500).json({ error: "Failed to get pipeline status" });
    }
  }
}