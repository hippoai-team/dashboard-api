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
  console.log('sources',sources)
  if (!sources || !Array.isArray(sources)) {
    return res.status(400).send({ error: 'Invalid input' });
  }

  try {
    const createdSources = await Promise.all(sources.map(async sourceData => {
      // Create a new source object
      const id = new mongoose.Types.ObjectId();
      const newSource = new newMasterSource({
        _id: id,
        metadata: { ...sourceData, source_id: id.toString() }, // Store all form data in metadata, including the mongoose id
        source_id: id.toString()
      });
      // Save to MongoDB
      return newSource.save();
      
    }));

    res.status(201).json({ message: "Sources created successfully", data: createdSources });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create sources" });
  }
};


exports.index = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.perPage) || 10;
      const tab = parseInt(req.query.active_tab);

      const skip = (page - 1) * perPage;
      const search = req.query.search || "";
      const sourceType = req.query.source_type || "";
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

      // Filtering by source type
      if (tab === 0) {
        //source type or first item in source list if sourcetype is ""
          query.source_type = sourceType || Object.keys(source_type_list)[0];
          // Only show pending sources in tab 0
          query.status = { $nin: ["approved", "rejected"] };

      } else {
          if (sourceType) {
          query['metadata.source_type'] = sourceType;
          }
      }

      // Fetching data based on tab selection
      let sources, master_sources, total_source_counts;
      if (tab === 0) {
          const effectiveSourceType = sourceType || Object.keys(source_type_list)[0];
          sources = await source_type_list[effectiveSourceType].find(query, null, { skip, limit: perPage });
          total_source_counts = { sources: await source_type_list[effectiveSourceType].countDocuments(query) };
      } else {
          master_sources = await newMasterSource.find(query, 'metadata processed id_', { skip, limit: perPage })
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

    const masterSources = sources_metadata.map(metadata => {
      return new newMasterSource({
        _id: new mongoose.Types.ObjectId(metadata._id),
        metadata: metadata,
        source_id: metadata._id,
      });
    });

    await Promise.all(masterSources.map(masterSource => masterSource.save()));

    const responseMessage = isSingleSource ? "Source approved successfully" : "Sources approved successfully";
    const responseData = isSingleSource ? { title: sources_metadata[0].title } : {};
    res.status(200).json({ message: responseMessage, data: responseData });
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

    await Promise.all(sources_metadata.map(metadata => {
      metadata.status = 'rejected';
      metadata.reviewed_at = new Date();
      return metadata.save();
    }));

    const responseMessage = sourceIds.length === 1 ? "Source rejected successfully" : "Sources rejected successfully";
    res.status(200).json({ message: responseMessage });
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