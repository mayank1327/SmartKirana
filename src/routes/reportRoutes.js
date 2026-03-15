const express = require('express');
const {
  getDashboardStats,
  getLowStockReport,
  getTodayBills,
  getWeeklyPurchases
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/dashboard', getDashboardStats);
router.get('/low-stock', getLowStockReport);
router.get('/today-bills', getTodayBills);
router.get('/weekly-purchases', getWeeklyPurchases);

module.exports = router;