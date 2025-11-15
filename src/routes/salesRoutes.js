const express = require('express');
const {
  createSale,
  getSales,
  getSale,
  getDailySales,
  getSalesAnalytics,
  getTodaySales
} = require('../controllers/salesController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createSaleSchema,getSalesSchema, saleIdSchema ,salesAnalyticsSchema, dailySalesSchema } = require('../validators/salesValidator');

const router = express.Router();

// Protect all routes
router.use(protect);

// Quick access routes (before parameterized routes)
router.get('/today',getTodaySales);
router.get('/daily', validate(dailySalesSchema), getDailySales);
router.get('/analytics', validate(salesAnalyticsSchema, 'query'), getSalesAnalytics);

// CRUD routes
router.route('/')
  .get(validate(getSalesSchema, 'query'),getSales)
  .post(validate(createSaleSchema),createSale);

router.route('/:saleId')
  .get(validate(saleIdSchema, 'params'), getSale);

module.exports = router;

