// Main application file (V in MVC - API responses)

const express = require('express');
const cors = require('cors');      // cors → Security (allow cross-origin requests). cors → Accessibility (allow frontend & backend to communicate safely).
const helmet = require('helmet'); // helmet → Security (protect your backend from common attacks).
const morgan = require('morgan'); // morgan → Logging (log HTTP requests for debugging and monitoring). // 	morgan → Visibility (log API calls for debugging & monitoring).
const config = require('./config');
const connectDB = require('./config/database');

const app = express();

// Connect to database
connectDB();

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Kirana Inventory Server Running',
        timestamp: new Date().toISOString()
      });
});

// Use middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});

module.exports = app;