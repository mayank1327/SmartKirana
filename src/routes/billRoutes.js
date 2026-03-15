const express = require('express');
const { 
  createBill, 
  getBills, 
  getBill
} = require('../controllers/billController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createBillSchema, getBillsQuerySchema, billIdParamSchema } = require('../validators/billValidator');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(validate(getBillsQuerySchema, 'query'), getBills)
  .post(validate(createBillSchema), createBill);

router.route('/:billId')
  .get(validate(billIdParamSchema, 'params'), getBill);

module.exports = router;