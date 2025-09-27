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

const router = express.Router();

// Protect all routes
router.use(protect);

// Quick access routes (before parameterized routes)
router.get('/today', getTodaysSales);
router.get('/daily', getDailySales);
router.get('/analytics', getSalesAnalytics);

// CRUD routes
router.route('/')
  .get(getSales)
  .post(createSale);

router.route('/:id')
  .get(getSale);

module.exports = router;