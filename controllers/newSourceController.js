const axios = require('axios');
const mongoose = require('mongoose');
const Image = require('image-js').Image;

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const S3Mapping = require('../models/S3Mapping');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const { createNewSourceModel, createNewMasterSourceModel, createImageSourceModel } = require('../models/NewSource');
const clinical_guidelines_master = createNewSourceModel('clinical_guidelines_master');
const review_articles_master = createNewSourceModel('review_articles_master');
const formulary_lists_master = createNewSourceModel('formulary_lists_master');
const drug_monographs_master = createNewSourceModel('drug_monographs_master');
const newMasterSource = createNewMasterSourceModel('master_sources');
const imageSource = createImageSourceModel('master_image_sources');

const source_type_list = {
  'clinical_guidelines': clinical_guidelines_master,
  'review_articles': review_articles_master,
  'formulary_lists': formulary_lists_master,
  'drug_monographs': drug_monographs_master,
};

//const PIPELINE_API_URL = process.env.PIPELINE_API_URL || 'http://34.231.170.38:8000';
const PIPELINE_API_URL = process.env.PIPELINE_API_URL || 'http://localhost:8000/pipeline';
//const PIPELINE_API_URL = 'https://pendiumdev.com/pipeline'

async function uploadFileToS3(fileBuffer, bucketName, key) {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
  };

  try {
    const data = await s3Client.send(new PutObjectCommand(params));
    return `https://${bucketName}.s3.amazonaws.com/${key}`;
  } catch (err) {
    console.error('Error uploading file to S3:', err);
    throw err;
  }
}

async function uploadImageToS3(imageBuffer, bucketName, key, contentType) {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: imageBuffer,
    ContentType: contentType,
  };

  try {
    const data = await s3Client.send(new PutObjectCommand(params));
    return `https://${bucketName}.s3.amazonaws.com/${key}`;
  } catch (err) {
    console.error('Error uploading image to S3:', err);
    throw err;
  }
}

function buildQuery(tab, search, sourceType, status, andConditions, orConditions) {
  let query = {};
  let defaultCondition = [];

  if (tab === 0 || tab === 2) { 
    query.source_type = sourceType || Object.keys(source_type_list)[0];
    defaultCondition.push({ $or: [{ status: { $exists: false } }, { status: 'pending' }] });
  }

  if (sourceType && tab === 1) {
    defaultCondition.push({ 'metadata.source_type': sourceType });
  }

  let statusCondition = [];
  if (status) {
    console.log(status)
    statusCondition = status === 'active' || status === 'processed' ? 
      { processed: status === 'processed', status: 'active' } :
      { status: status };
  }
  console.log(statusCondition)

  if (orConditions.length > 0 || andConditions.length > 0 || defaultCondition.length > 0) {
    query.$and = [...orConditions, ...andConditions, ...defaultCondition];
  }
  if (statusCondition.length !== 0) {
    query.$and.push(statusCondition);
  }

  return query;
}

async function handleSourcesTab(query, skip, limit, sortOrder) {
  const effectiveSourceType = query.source_type;
  const sources = await source_type_list[effectiveSourceType].find(query, null, { skip, limit })
    .sort({ timestamp: sortOrder }).lean();
  const total_source_counts = await source_type_list[effectiveSourceType].countDocuments(query) 
  
  return { sources, total_source_counts };
}

async function handleMasterSourcesTab(query, skip, limit, sortOrder) {
  let sources = await newMasterSource.find(query, 'metadata status processed id_ timestamp nodes images', { skip, limit })
    .sort({ timestamp: sortOrder });
  sources = sources.map(doc => ({
    ...doc.metadata,
    processed: doc.processed,
    _id: doc._id,
    timestamp: doc.timestamp,
    status: doc.status,
    nodes: doc.nodes.map(node => `[source number: ${node.metadata.source_number}] ${node.text}`), // Extracting text from each node, prepending with source number, and appending to the sources array
    images: doc.images.filter(img => img.processed).map(img => ({
      title: img.image_title,
      description: img.image_description,
      sourceUrl: img.source_url
    })) // Filtering images where processed is true, then creating an object with title, description, and sourceUrl for each image
  }));
  const total_source_counts =  await newMasterSource.countDocuments(query) 
  
  return { sources, total_source_counts };
}

async function handleImageSourcesTab(query, skip, limit, sortOrder) {
  const sources = await imageSource.find(query, null, { skip, limit })
    .sort({ timestamp: sortOrder }).lean();
  const total_source_counts = await imageSource.countDocuments(query) 
  return { sources, total_source_counts };
}


exports.store = async (req, res) => {
  try {
    const sources = JSON.parse(req.body.sources); // Parsing sources from JSON string in formData
    const file = req.file; // Access file provided in the form field named 'file'

    if (!Array.isArray(sources)) {
      return res.status(400).send({ error: 'Invalid input' });
    }

    let createdSources = [];
    let sourceActionStatus = [];
    for (const sourceData of sources) {
      try {
        const id = new mongoose.Types.ObjectId();

        if (sourceData.load_type === 'image') {
          let file_extension;
          let contentType;
          if (file.buffer instanceof Buffer) {
              const image_stream = new Image();
              image_stream.src = file.buffer;
              file_extension = 'jpeg';
              contentType = 'image/jpeg';
          } else {
              file_extension = file.originalname.split(".").pop();
              if (file_extension === "jpeg") {
                  contentType = "image/jpeg";
              } else if (file_extension === "png") {
                  contentType = "image/png";
              } else {
                  contentType = "binary/octet-stream";
              }
          }
          const fileKey = `extracted_images/${id.toString()}.${file_extension}`;

          const fileLocation = await uploadImageToS3(file.buffer, 'pendium-images', fileKey, contentType);

          const newImageSource = new imageSource({
            _id: id,
            source_id: id.toString(),
            title: sourceData.title,
            status: 'active',
            source_url: fileLocation,
            source_type: sourceData.source_type,
            processed: false,
            date_added: new Date()
          });

          const createdImageSource = await newImageSource.save();
          createdSources.push(createdImageSource);
          sourceActionStatus.push({ source_url: sourceData.source_url, source_title: sourceData.title, status: 'created', type: 'image' });
        } else {
          const existingSource = await newMasterSource.findOne({ 'metadata.source_url': sourceData.source_url });
          if (existingSource) {
            sourceActionStatus.push({ source_url: sourceData.source_url, source_title: sourceData.title, status: 'exists' });
            continue;
          }

          const newSource = new newMasterSource({
            _id: id,
            metadata: { ...sourceData, source_id: id.toString() },
            source_id: id.toString(),
            timestamp: new Date(),
            status: 'active'
          });

          if (file) {
            const fileKey = `all-pdfs/${id.toString()}.pdf`;
            const fileLocation = await uploadFileToS3(file.buffer, 'hippo-sources', fileKey);

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
        }
      } catch (error) {
        console.error(error);
        sourceActionStatus.push({ source_url: sourceData.source_url, source_title: sourceData.title, status: 'error', error: error.message });
      }
    }

    res.status(201).json({ createdSources, sourceActionStatus });
  } catch (error) {
    console.error("Error in store function:", error);
    res.status(500).json({ error: "Failed to store sources due to server error" });
  }
};

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
    const baseSearch = { $regex: search, $options: "i" };
    const searchQueries = {
      $or: tab === 1 ? [
        { 'metadata.title': baseSearch },
        { 'metadata.publisher': baseSearch },
        { 'metadata.subspecialty': baseSearch }
      ] : [
        { title: baseSearch },
        { publisher: baseSearch },
        { subspecialty: baseSearch }
      ]
    };

    const andConditions = search ? [searchQueries] : [];
    const orConditions = [];
    const query = buildQuery(tab, search, sourceType, status, andConditions, orConditions);
    console.log(query);
    let responseData;
    switch (tab) {
      case 0:
        responseData = await handleSourcesTab(query, skip, perPage, sortOrder);
        break;
      case 1:
        responseData = await handleMasterSourcesTab(query, skip, perPage, sortOrder);
        break;
      case 2:
        responseData = await handleImageSourcesTab(query, skip, perPage, sortOrder);
        break;
      default:
        throw new Error("Invalid tab selection");
    }
    res.json({
      ...responseData,
      source_types: Object.keys(source_type_list),
    });
  } catch (error) {
    console.error("Error in index function:", error);
    res.status(500).json({ error: "Failed to fetch sources due to server error" });
  }
};

exports.show = async (req, res) => {
  try {
    const { id } = req.params;
    const { tab, sourceTypeFilter } = req.query;
    let sourceModel;

    if (tab === '0') {
      sourceModel = source_type_list[sourceTypeFilter];
    } else if (tab === '1') {
      sourceModel = newMasterSource;
    } else {
      return res.status(400).json({ error: "Invalid tab selection" });
    }

    const source = await sourceModel.findById(id);
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }

    res.json(tab === '0' ? source : source.metadata);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch source" });
  }
};

exports.update = async (req, res) => {
  const { sourceType, tab, id } = req.body;
  const sourceData = JSON.parse(req.body.sources)[0];
  let sourceActionStatus = [];
  try {
    let updateResult;
    let sourceTitle, sourceUrl;
    let fileLocation;
    if (tab === '0') {
      const source_metadata = await source_type_list[sourceType].findById(id);
      if (!source_metadata) {
        sourceActionStatus.push({ source_title: "", source_url: "", status: 'not_found' });
        return res.status(404).json({ error: "Source not found", sourceActionStatus });
      }

      sourceTitle = source_metadata.title;
      sourceUrl = source_metadata.source_url;

      for (const key in sourceData) {
        source_metadata[key] = sourceData[key];
      }
      source_metadata.timestamp = new Date();

      if (req.file) {
        const fileKey = `all-pdfs/${id}.pdf`;
        fileLocation = await uploadFileToS3(req.file.buffer, 'hippo-sources', fileKey);
        source_metadata.fileLocation = fileLocation;
      }
  
      updateResult = await source_metadata.save();
      sourceActionStatus.push({ source_title: sourceTitle, source_url: sourceUrl, status: 'updated' });
    } else if (tab === '1') {
      const master_source_document = await newMasterSource.findById(id);
      if (!master_source_document) {
        sourceActionStatus.push({ source_title: "", source_url: "", status: 'not_found' });
        return res.status(404).json({ error: "Master source not found", sourceActionStatus });
      }

      sourceTitle = master_source_document.metadata.title;
      sourceUrl = master_source_document.metadata.source_url;

      for (const key in sourceData) {
        master_source_document.metadata[key] = sourceData[key];
      }
      master_source_document.timestamp = new Date();

      if (req.file) {
        const fileKey = `all-pdfs/${id}.pdf`;
        fileLocation = await uploadFileToS3(req.file.buffer, 'hippo-sources', fileKey);
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
    //sourceActionStatus.push({ source_title: sourceTitle, source_url: sourceUrl, status: 'error', error: error.message });
    res.status(500).json({ error: "Failed to update source due to server error", sourceActionStatus });
  }
};

exports.destroy = async (req, res) => {
  try {
    const id = req.params.id;
    const title = await Source.findOne({ _id: id }, { title: 1, _id: 0 });

    await Source.updateOne({ _id: req.params.id }, { status: 'remove' });
    
    const response = await axios.post(`${PIPELINE_API_URL}/process_ids`, { ids: [id] });
    console.log(response.data);
    
    res.status(200).send('Source soft deleted successfully');
  } catch (error) {
    res.status(500).send('Server error');
  }
};

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
  const { sourceIds, sourceType, rejectReason } = req.body;
  try {
    const sources_metadata = await source_type_list[sourceType].find({ _id: { $in: sourceIds } });
    if (sources_metadata.length !== sourceIds.length) {
      return res.status(404).json({ error: "One or more sources not found" });
    }

    const statusReport = [];

    for (const metadata of sources_metadata) {
      metadata.status = 'rejected';
      metadata.notes = rejectReason;
      metadata.reviewed_at = new Date();
      await metadata.save();
      statusReport.push({
        url: metadata.source_url,
        title: metadata.title,
        status: 'rejected - ' + rejectReason,
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
    res.status(500).json({ error: "Failed to reject sources" });
}

};

exports.process = async (req, res) => {
  const { sourceIds } = req.body;
  try {
    const response = await axios.post(`${PIPELINE_API_URL}/ingest`, sourceIds );
    res.status(200).json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.process_image = async (req, res) => {
  const { sourceIds } = req.body;
  try {
    const response = await axios.post(`${PIPELINE_API_URL}/images/process/`, sourceIds);
    res.status(200).json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

exports.delete = async (req, res) => {
  const { sourceIds } = req.body;
  try {
    const response = await axios.post(`${PIPELINE_API_URL}/delete`, { document_ids: sourceIds });
    res.status(200).json({ message: "Source deleted successfully", data: response.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete source" });
  }
};

exports.delete_images = async (req, res) => {
  const { sourceIds } = req.body;
  try {
    const sources = await imageSource.find({ _id: { $in: sourceIds } });
    for (const source of sources) {
      source['status'] = 'inactive';
      await source.save();
    }
    
    
    res.status(200).json({ message: "Images status updated to 'rejected' successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update image status" });
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
};
