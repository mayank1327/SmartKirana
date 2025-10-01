const express = require('express');
const {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');

const router = express.Router();

const validate = require('../middleware/validate'); // Import validation middleware
const {createProductSchema, updateProductSchema}  = require('../validators/productValidator'); // Import product validation schema

// Protect all routes
router.use(protect);

// Low stock products (special route before /:id)
router.get('/low-stock', getLowStockProducts);

// CRUD routes
router.route('/')
  .get(getAllProducts)
  .post(validate(createProductSchema),createProduct);

router.route('/:id')
  .get(getProduct)
  .put(validate(updateProductSchema), updateProduct)
  .delete(deleteProduct);

module.exports = router;