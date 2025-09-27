const express = require('express');
const {
  getDashboardStats,
  getLowStockReport,
  getDailySalesReport,
  getInventoryValuation,
  getProfitAnalysis,
  getBusinessSummary,
  getAlertsSummary
} = require('../controllers/reportController');
const alertService = require('../services/alertService');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// Dashboard and summary routes
router.get('/dashboard', getDashboardStats);
router.get('/business-summary', getBusinessSummary);

// Alert routes
router.get('/alerts', getAlertsSummary);
router.get('/alerts/all', async (req, res, next) => {
  try {
    const alerts = await alertService.generateAllAlerts();
    res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    next(error);
  }
});

// Specific report routes
router.get('/low-stock', getLowStockReport);
router.get('/daily-sales', getDailySalesReport);
router.get('/inventory-valuation', getInventoryValuation);
router.get('/profit-analysis', getProfitAnalysis);

module.exports = router;