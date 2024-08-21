const express = require("express");
const app = express();

const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require("./api/authRoutes");
const betaListRoutes = require("./api/betaListRoute");
const chatLogRoutes = require("./api/chatLogRoutes");
const userRoutes = require("./api/userRoutes");
const usageRoutes = require("./api/usageRoutes");
const newSourceRoutes = require("./api/newSourceRoutes");
const ec2Routes = require("./api/ec2Routes");

// middlewares
app.use(express.json({ extended: false }));
app.use(cors());
app.use(bodyParser.json());

// config
dotenv.config();
const MONGO_URL = process.env.MONGO_URL;
console.log('MONGO_URL', MONGO_URL)
// Connect to MongoDB
mongoose.connect(MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//ping mongo deployment

app.get('/', (req, res) => {
  res.send('Hello, Express World!');
});

// routes
app.use('/api/betalist', betaListRoutes)
app.use('/api/chatlogs', chatLogRoutes)
app.use('/api/users', userRoutes)
app.use('/api/usage', usageRoutes)
app.use('/api/master-sources', newSourceRoutes)
app.use('/api/pipeline', ec2Routes)

app.use('/admin', authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running in port ${PORT}`));
