const express = require('express');
const {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');

const router = express.Router();

const validate = require('../middleware/validate'); // Import validation middleware
const {createProductSchema, updateProductSchema}  = require('../validators/productValidator'); // Import product validation schema

// Protect all routes
router.use(protect);

// CRUD routes
router.route('/')
  .get(getAllProducts)
  .post(validate(createProductSchema),createProduct);

router.route('/:id')
  .get(getProduct)
  .put(validate(updateProductSchema), updateProduct)
  .delete(deleteProduct);

module.exports = router;