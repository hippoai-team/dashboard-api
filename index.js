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

// routes
app.use('/api/sources', sourceRoutes);
app.use('/api/betalist', betaListRoutes)
app.use('/api/chatlogs', chatLogRoutes)
app.use('/api/users', userRoutes)

app.use('/admin', authRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server is running in port ${PORT}`));
