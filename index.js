const express = require("express");
const app = express();

const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const sourceRoutes = require("./api/sourceRoutes");
const authRoutes = require("./api/authRoutes");
const betaListRoutes = require("./api/betaListRoute");
const chatLogRoutes = require("./api/chatLogRoutes");
const userRoutes = require("./api/userRoutes");
// middlewares
app.use(express.json({ extended: false }));
app.use(cors());
app.use(bodyParser.json());

// config
dotenv.config();
console.log(process.env.MONGO_URL);
const MONGO_URL = process.env.MONGO_URL;

// Connect to MongoDB
mongoose.connect(MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//ping mongo deployment

app.get('/', (req, res) => {
  res.send('Hello, Express World!');
});

//status checks for sources processing
const taskStatus = {};  // In-memory storage for task statuses

app.post('/task/start', (req, res) => {
  const { task_uuid } = req.body;
  console.log('task_uuid', task_uuid)
  taskStatus[task_uuid] = "processing";
  res.sendStatus(200);
});

app.post('/task/done', (req, res) => {
  const { task_uuid, response } = req.body;
  console.log('task_uuid', task_uuid)
  console.log('response', response)
  taskStatus[task_uuid] = { status: "done", response };
  res.sendStatus(200);
});

app.get('/status/:task_uuid?', (req, res) => {
  const { task_uuid } = req.params;
  if (task_uuid) {
    if (taskStatus[task_uuid]) {
      res.json(taskStatus[task_uuid]);
    } else {
      res.json({ status: "unknown" });
    }
  } else {
    if (Object.keys(taskStatus).length > 0) {
      res.json(taskStatus);
    } else {
      console.log('no tasks')
      res.json({ status: "no tasks" });
    }
  }
});

// routes
app.use('/api/sources', sourceRoutes);
app.use('/api/betalist', betaListRoutes)
app.use('/api/chatlogs', chatLogRoutes)
app.use('/api/users', userRoutes)

app.use('/admin', authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running in port ${PORT}`));
