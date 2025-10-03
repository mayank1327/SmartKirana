const express = require('express');
const {
  createSale,
  getSales,
  getSale,
  getDailySales,
  getSalesAnalytics,
  getTodaysSales
} = require('../controllers/salesController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createSaleSchema, getSalesQuerySchema, getSaleByIdSchema } = require('../validators/salesValidator');

const router = express.Router();

// Protect all routes
router.use(protect);

// Quick access routes (before parameterized routes)
router.get('/today', getTodaysSales);
router.get('/daily', getDailySales);
router.get('/analytics', getSalesAnalytics);

// CRUD routes
router.route('/')
  .get(validate(getSalesQuerySchema, 'query'),getSales)
  .post(validate(createSaleSchema),createSale);

router.route('/:id')
  .get(validate(getSaleByIdSchema, 'params'), getSale);

module.exports = router;


// Optimization Opportunities:

// Batch product fetching in createSale (one query vs N)
// Payment status logic (handle full credit case)
// Add costPrice to saleItem (for profit calculations)
// Concurrent sale number generation (race condition fix)
// Index optimization (compound indexes based on query patterns)

