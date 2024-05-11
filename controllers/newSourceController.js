// controllers/SourceController.js
const axios = require('axios');
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const S3Mapping = require('../models/S3Mapping');
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const { createNewSourceModel, createNewMasterSourceModel } = require('../models/NewSource');
const clinical_guidelines_master = createNewSourceModel('clinical_guidelines_master');
const review_articles_master = createNewSourceModel('review_articles_master');
const formulary_lists_master = createNewSourceModel('formulary_lists_master');
const drug_monographs_master = createNewSourceModel('drug_monographs_master');
const newMasterSource = createNewMasterSourceModel('master_sources');

const source_type_list = {
    'clinical_guidelines': clinical_guidelines_master,
    'review_articles': review_articles_master,
    'formulary_lists': formulary_lists_master,
    'drug_monographs': drug_monographs_master
}

//const PIPELINE_API_URL = process.env.PIPELINE_API_URL || "http://15.222.26.222:8080";
const PIPELINE_API_URL = 'http://127.0.0.1:8000';
const s3 = new AWS.S3();

async function uploadFileToS3(fileBuffer, bucketName, key) {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
  };

  try {
    const data = await s3.upload(params).promise();
    return data.Location;
  } catch (err) {
    console.error('Error uploading file to S3:', err);
    throw err;
  }
}

exports.store = async (req, res) => {
    let sources;
    try {
      sources = JSON.parse(req.body.sources); // Parsing sources from JSON string in formData
    } catch (parseError) {
      return res.status(400).send({ error: 'Invalid JSON format for sources' });
    }
    const pdfFile = req.file; // Access file provided in the form field named 'pdfFile'

    if (!sources || !Array.isArray(sources)) {
      return res.status(400).send({ error: 'Invalid input' });
    }


  let createdSources = [];
  let sourceActionStatus = [];

  for (const sourceData of sources) {
    try {
      const existingSource = await newMasterSource.findOne({ 'metadata.source_url': sourceData.source_url });
      if (existingSource) {
        sourceActionStatus.push({ source_url: sourceData.source_url, source_title: sourceData.title, status: 'exists' });
        continue;
      }
  
      const id = new mongoose.Types.ObjectId();
      const newSource = new newMasterSource({
        _id: id,
        metadata: { ...sourceData, source_id: id.toString() },
        source_id: id.toString()
      });
  
      if (pdfFile) {  // Check if there's a PDF file uploaded with the request
        const fileKey = `all-pdfs/${id.toString()}.pdf`;  // Construct S3 key using the Mongo ID
        const fileLocation = await uploadFileToS3(pdfFile.buffer, 'hippo-sources', fileKey);
        console.log(fileLocation)
  
        // Save the mapping in MongoDB (assuming you have a model for this)
        const mappingDoc = new S3Mapping({
          _id: id,
          mongodb_id: id.toString(),
          s3_key: fileKey
        });
        await mappingDoc.save();
      }
  
      const createdSource = await newSource.save();
      createdSources.push(createdSource);
      sourceActionStatus.push({ source_url: sourceData.source_url, source_title: sourceData.title, status: 'created' });
    } catch (error) {
      console.error(error);
      sourceActionStatus.push({ source_url: sourceData.source_url, source_title: sourceData.title, status: 'error', error: error.message });
    }
  }
  
  res.status(201).json({ createdSources, sourceActionStatus });
  
}




exports.index = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.perPage) || 10;
      const tab = parseInt(req.query.active_tab);
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
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
          sources = await source_type_list[effectiveSourceType].find(query, null, { skip, limit: perPage }).sort({ timestamp: sortOrder });
          total_source_counts = { sources: await source_type_list[effectiveSourceType].countDocuments(query) };
      } else {
          master_sources = await newMasterSource.find(query, 'metadata processed id_ timestamp', { skip, limit: perPage }).sort({ timestamp: sortOrder });
          master_sources = master_sources.map(doc => ({
              ...doc.metadata,
              processed: doc.processed,
              _id: doc._id,
              timestamp: doc.timestamp

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
    const { id } = req.params;
    const { tab, sourceTypeFilter } = req.query;
    let sourceModel;
    let responseData;

    if (tab === '0') {
      sourceModel = source_type_list[sourceTypeFilter];
      const source = await sourceModel.findById(id);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      responseData = source;
    } else if (tab === '1') {
      sourceModel = newMasterSource;
      const source = await sourceModel.findById(id);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      responseData = source.metadata;
    } else {
      return res.status(400).json({ error: "Invalid tab selection" });
    }

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch source" });
  }
};

exports.update = async (req, res) => {
  const { sourceType, tab, id, ...sourceData } = req.body;
  let sourceActionStatus = [];

  try {
    let updateResult;
    let sourceTitle, sourceUrl;
    let fileLocation;

    if (tab === '0') {
      // Handle specific source types
      const source_metadata = await source_type_list[sourceType].findById(id);
      if (!source_metadata) {
        sourceActionStatus.push({ source_title: "", source_url: "", status: 'not_found' });
        return res.status(404).json({ error: "Source not found", sourceActionStatus });
      }

      sourceTitle = source_metadata.title;
      sourceUrl = source_metadata.source_url;

      // Update metadata fields
      for (const key in sourceData) {
        source_metadata[key] = sourceData[key];
      }
      source_metadata.timestamp = new Date();

      // Handle file upload if new file is provided
      if (req.file) {
        const fileKey = `all-pdfs/${id}.pdf`;  // Re-use the existing S3 key or generate a new key strategy
        fileLocation = await uploadFileToS3(req.file.buffer, 'hippo-sources', fileKey);
        // Update file location in metadata if needed
        source_metadata.fileLocation = fileLocation;
      }

      updateResult = await source_metadata.save();
      sourceActionStatus.push({ source_title: sourceTitle, source_url: sourceUrl, status: 'updated' });
    } else if (tab === '1') {
      // Similar logic for master sources
      const master_source_document = await newMasterSource.findById(id);
      if (!master_source_document) {
        sourceActionStatus.push({ source_title: "", source_url: "", status: 'not_found' });
        return res.status(404).json({ error: "Master source not found", sourceActionStatus });
      }
      console.log(master_source_document)
      sourceTitle = master_source_document.metadata.title;
      sourceUrl = master_source_document.metadata.source_url;

      for (const key in sourceData) {
        master_source_document.metadata[key] = sourceData[key];
      }
      master_source_document.timestamp = new Date();

      if (req.file) {
        const fileKey = `all-pdfs/${id}.pdf`; // Different key or same key logic
        fileLocation = await uploadFileToS3(req.file.buffer, 'hippo-sources', fileKey);
        // Update file location in metadata
        master_source_document.metadata.fileLocation = fileLocation;
      }

      master_source_document.markModified('metadata');
      updateResult = await master_source_document.save();

      sourceActionStatus.push({ source_title: sourceTitle, source_url: sourceUrl, status: 'updated' });
    } else {
      sourceActionStatus.push({ source_title: "", source_url: "", status: 'invalid_tab' });
      return res.status(400).json({ error: "Invalid tab selection", sourceActionStatus });
    }

    if (updateResult) {
      res.status(200).json({ message: "Source updated successfully", sourceActionStatus });
    }
  } catch (error) {
    console.error("Error updating source:", error);
    sourceActionStatus.push({ source_title: sourceTitle, source_url: sourceUrl, status: 'error', error: error.message });
    res.status(500).json({ error: "Failed to update source due to server error", sourceActionStatus });
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
          timestamp: new Date()
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