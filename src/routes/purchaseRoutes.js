const express = require('express');
const {
  createPurchase,
  getPurchases,
  getPurchase,
  updatePaymentStatus,
  getPendingPayments,
  getSupplierSummary,
  getPurchaseAnalytics,
  getTodaysPurchases
} = require('../controllers/purchaseController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// Quick access routes (before parameterized routes)
router.get('/today', getTodaysPurchases);
router.get('/pending-payments', getPendingPayments);
router.get('/supplier-summary', getSupplierSummary);
router.get('/analytics', getPurchaseAnalytics);

// CRUD routes
router.route('/')
  .get(getPurchases)
  .post(createPurchase);

router.route('/:id')
  .get(getPurchase);

// Payment management
router.put('/:id/payment', updatePaymentStatus);

module.exports = router;