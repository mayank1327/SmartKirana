const express = require('express');
const {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createProductSchema,
  updateProductSchema,
  getProductsQuerySchema,
  productIdParamSchema
} = require('../validators/productValidator');

const router = express.Router();

// Protect all routes (require authentication)
router.use(protect);

// CRUD routes
router.route('/')
  .get(validate(getProductsQuerySchema, 'query'), getAllProducts)
  .post(validate(createProductSchema), createProduct);

router.route('/:id')
  .get(validate(productIdParamSchema, 'params'), getProduct)
  .put(
    validate(productIdParamSchema, 'params'),
    validate(updateProductSchema),
    updateProduct
  )
  .delete(validate(productIdParamSchema, 'params'), deleteProduct);

module.exports = router;