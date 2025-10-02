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
const validate = require('../middleware/validate');
const purchaseValidator = require('../validators/purchaseValidator');

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
  .get(validate(purchaseValidator.getPurchasesQuerySchema, 'query'),getPurchases)
  .post(validate(purchaseValidator.createPurchaseSchema), createPurchase);

router.route('/:id')
  .get(getPurchase);

// Payment management
router.put('/:id/payment', validate(purchaseValidator.updatePaymentSchema),updatePaymentStatus);

module.exports = router;