const express = require('express');
const {
  createBill,
  getBills,
  getBill,
  getTodaysBills,
  getTemporaryProducts,
  completeTemporaryProductSetup,
  deleteTemporaryProduct
} = require('../controllers/billController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createBillSchema,
  getBillsQuerySchema,
  billIdParamSchema,
  tempProductIdParamSchema,
  completeSetupSchema
} = require('../validators/billValidator');

const router = express.Router();

// Protect all routes
router.use(protect);

// Bill routes
router.route('/')
  .get(validate(getBillsQuerySchema, 'query'), getBills)
  .post(validate(createBillSchema), createBill);

router.get('/today', getTodaysBills);

// Temporary products routes
router.get('/temporary-products', getTemporaryProducts);

router.route('/:billId')
  .get(validate(billIdParamSchema, 'params'), getBill);


router.route('/temporary-products/:tempProductId/complete-setup')
  .post(
    validate(tempProductIdParamSchema, 'params'),
    validate(completeSetupSchema),
    completeTemporaryProductSetup
  );

router.route('/temporary-products/:tempProductId')
  .delete(
    validate(tempProductIdParamSchema, 'params'),
    deleteTemporaryProduct
  );

module.exports = router;