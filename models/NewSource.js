const mongoose = require('mongoose');
pendium_db = mongoose.createConnection(process.env.MONGO_URL_2, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const newSourceSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  source_url: String,
  date_published: String,
  subject_specialty: String,
  title: String,
  publisher: String,
  source_type: String,
  access_status: String,
  load_type: String,
  content_type: String,
  language: String,
  audience: String,
  keywords: [String],
  country: String,
  source_id: String,
  status: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    required: false
  },
  reviewed_at: {
    type: Date,
    required: false
  }
  });
const newMasterSourceSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: function () {
      return new mongoose.Types.ObjectId();
    },
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  processed: {
    type: Boolean,
    default: false
  },
  metadata_hash: {
    type: String,
    default: ""
  },
  nodes: {
    type: Array,
    default: []
  },
  status: {
    type: String,
    default: "active",
    enum: ["active", "inactive", "removed"]
  },
  last_processed: {
    type: String,
    default: ""
  },
  llama_document_ids: {
    type: Array,
    default: []
  },
  summary_node: {
    type: Object,
    default: {}
  },
  source_id:{
    type: String,
    default: ""
  },
  timestamp: {
    type: Date,
    default: ""
  }

});

const imageSourceSchema = {
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: function () {
      return new mongoose.Types.ObjectId();
    },
    required: true
  },
    source_id: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    status: {
      type: String,
      required: true
    },
    source_url: {
      type: String,
      required: true
    },
    source_type: {
      type: String,
      required: true
    },
    processed: {
      type: Boolean,
      default: false
    },
    date_added: {
      type: Date,
      default: () => new Date()
    }
  };



function createNewSourceModel(collectionName) {
    return pendium_db.model('NewSource', newSourceSchema, collectionName);
  }

  function createNewMasterSourceModel(collectionName) {
    return pendium_db.model('NewMasterSource', newMasterSourceSchema, collectionName);
  }

  function createImageSourceModel(collectionName) {
    return pendium_db.model('ImageSource', imageSourceSchema, collectionName);
  }
  
module.exports = {
    createNewSourceModel,
    createNewMasterSourceModel,
    createImageSourceModel
  };
