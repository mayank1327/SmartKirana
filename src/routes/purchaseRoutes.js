const express = require('express');
const {
  createPurchase,
  getPurchases,
  getPurchase,
} = require('../controllers/purchaseController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createPurchaseSchema,
  getPurchasesQuerySchema,
  purchaseIdParamSchema
} = require('../validators/purchaseValidator');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(validate(getPurchasesQuerySchema, 'query'), getPurchases)
  .post(validate(createPurchaseSchema), createPurchase);

router.route('/:purchaseId')
  .get(validate(purchaseIdParamSchema, 'params'), getPurchase);

module.exports = router;