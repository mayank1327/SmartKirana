const express = require('express');
const {
  getPendingProducts,
  deleteTemporaryProduct,
  setupProduct
} = require('../controllers/temporaryProductController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  tempProductIdParamSchema,
  getTempProductsQuerySchema
} = require('../validators/temporaryProductValidator');
const { createProductSchema } = require('../validators/productValidator');

const router = express.Router();

router.use(protect);

router.get('/', validate(getTempProductsQuerySchema, 'query'), getPendingProducts);

router.post('/:tempProductId/setup',
  validate(tempProductIdParamSchema, 'params'),
  validate(createProductSchema),
  setupProduct
);

router.delete('/:tempProductId',
  validate(tempProductIdParamSchema, 'params'),
  deleteTemporaryProduct
);


module.exports = router;