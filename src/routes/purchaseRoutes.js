const express = require('express');
const {
  createPurchase,
  getPurchases,
  getPurchase,
  getTodaysPurchases
} = require('../controllers/purchaseController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createPurchaseSchema,
  getPurchasesQuerySchema,
  purchaseIdParamSchema
} = require('../validators/purchaseValidator');

const router = express.Router();

// Protect all routes
router.use(protect);

// Purchase routes
router.route('/')
  .get(validate(getPurchasesQuerySchema, 'query'), getPurchases)
  .post(validate(createPurchaseSchema), createPurchase);

router.get('/today', getTodaysPurchases);

router.route('/:purchaseId')
  .get(validate(purchaseIdParamSchema, 'params'), getPurchase);

module.exports = router;