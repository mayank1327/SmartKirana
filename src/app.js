// Main application file (V in MVC - API responses)

const express = require('express');
const cors = require('cors');      // cors → Security (allow cross-origin requests). cors → Accessibility (allow frontend & backend to communicate safely).
const helmet = require('helmet'); // helmet → Security (protect your backend from common attacks).
const morgan = require('morgan'); // morgan → Logging (log HTTP requests for debugging and monitoring). // Logging middleware (who hit API, status code, response time).


const app = express();

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Routes
// auth routes
const authRoutes = require('./routes/authRoutes');
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

// report routes
const reportRoutes = require('./routes/reportRoutes');
app.use('/api/reports', reportRoutes);

// health route
const healthRoutes = require('./routes/healthRoutes');
app.use('/api', healthRoutes);


// Test protected route
const { protect, authorize } = require('./middleware/auth');
app.get('/api/test-protected', protect, authorize('owner'), (req, res) => {
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
app.use(errorHandler);

const notFound = require('./middleware/notFound');
app.use(notFound);



module.exports = app;