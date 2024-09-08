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
    origin: ['http://localhost:3001/','https://fragment2.vercel.app/', 'https://ab-test-inky.vercel.app/'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204
  };
  
  app.use(cors(corsOptions));

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

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Create a dynamic schema
const MetricSchema = new mongoose.Schema({}, { strict: false });
const Metric = mongoose.model('Metric', MetricSchema);

app.use(bodyParser.json());

// API endpoint to receive metrics
app.post('/api/metrics', async (req, res) => {
  try {
    const metricData = req.body;
    const newMetric = new Metric(metricData);
    await newMetric.save();
    res.status(201).json({ message: 'Metric saved successfully', id: newMetric._id });
  } catch (error) {
    res.status(500).json({ error: 'Error saving metric' });
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