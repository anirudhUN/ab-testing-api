const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const basicAuth = require('express-basic-auth');
const cors = require('cors');

// Load environment variables from .env file in non-production environments
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();

const corsOptions = {
  origin: ['http://localhost:3001', 'https://fragment2.vercel.app', 'https://ab-test-inky.vercel.app'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Add body parsing middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Basic authentication middleware
app.use(basicAuth({
  users: { [process.env.API_USER]: process.env.API_PASSWORD },
  challenge: true,
  realm: 'A/B Testing API',
}));

// Use environment variable for MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

let isConnected = false;  // To track MongoDB connection status

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    isConnected = true;
    console.log('Connected to MongoDB');
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.use(async (req, res, next) => {
  if (!isConnected) {
    try {
      await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
      isConnected = true;
    } catch (err) {
      console.error('Error connecting to MongoDB:', err);
      return res.status(500).json({ error: 'Database connection error' });
    }
  }
  next();
});

// Function to create a Mongoose model dynamically based on collection name
const getDynamicModel = (collectionName) => {
  if (mongoose.models[collectionName]) {
    return mongoose.model(collectionName);
  }
  
  const schema = new mongoose.Schema({}, { 
    strict: false,
    collection: collectionName  // Explicitly set the collection name
  });

  return mongoose.model(collectionName, schema);
};

// API endpoint to receive metrics and dynamically select a collection
app.post('/api/:collectionName/metrics', async (req, res) => {
  const { collectionName } = req.params;  // Get collection name from URL
  const metricData = req.body;

  try {
    // Get dynamic model for the collection
    const Metric = getDynamicModel(collectionName);

    const newMetric = new Metric(metricData);
    await newMetric.save();
    res.status(201).json({ message: 'Metric saved successfully', id: newMetric._id });
  } catch (error) {
    console.error('Error saving metric:', error);
    res.status(500).json({ error: 'Error saving metric', details: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Vercel uses the `app` export
module.exports = app;