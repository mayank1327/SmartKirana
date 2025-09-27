// Main application file (V in MVC - API responses)

const express = require('express');
const cors = require('cors');      // cors → Security (allow cross-origin requests). cors → Accessibility (allow frontend & backend to communicate safely).
const helmet = require('helmet'); // helmet → Security (protect your backend from common attacks).
const morgan = require('morgan'); // morgan → Logging (log HTTP requests for debugging and monitoring). // 	morgan → Visibility (log API calls for debugging & monitoring).
const config = require('./config');
const connectDB = require('./config/database');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Connect to database
connectDB();

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes

// auth routes
app.use('/api/auth', authRoutes);

// product routes
const productRoutes = require('./routes/productRoutes');
app.use('/api/products', productRoutes);


// invventory routes
const inventoryRoutes = require('./routes/inventoryRoutes');
app.use('/api/inventory', inventoryRoutes);

// sales routes
const salesRoutes = require('./routes/salesRoutes');
app.use('/api/sales', salesRoutes);

// purchase routes
const purchaseRoutes = require('./routes/purchaseRoutes');
app.use('/api/purchases', purchaseRoutes);


// Test route
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Kirana Inventory Server Running',
        timestamp: new Date().toISOString()
      });
});

// Test protected route
const { protect } = require('./middleware/auth');
app.get('/api/test-protected', protect, (req, res) => {
  console.log("Yeh Protected Route hai... Access Granted!!")
  res.json({
    success: true,
    message: 'Access granted',
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
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