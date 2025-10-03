const express = require('express');
const {
  updateStock,
  addStock,
  reduceStock,
  adjustStock,
  getStockHistory,
  getStockSummary,
  getRecentMovements
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {updateStockSchema, addStockSchema, reduceStockSchema, adjustStockSchema, getStockHistoryQuerySchema, recentMovementsQuerySchema} = require('../validators/inventoryValidator');  

const router = express.Router();

// Protect all routes
router.use(protect);  // TODO : Role-based access control can be added here

// Stock operation routes
router.post('/update-stock', validate(updateStockSchema),updateStock);
router.post('/add-stock', validate(addStockSchema),addStock);
router.post('/reduce-stock', validate(reduceStockSchema),reduceStock);
router.post('/adjust-stock', validate(adjustStockSchema),adjustStock);

// History and summary routes
router.get('/summary', getStockSummary);
router.get('/recent-movements', validate(recentMovementsQuerySchema, 'query'),getRecentMovements);
router.get('/history/:productId', validate(getStockHistoryQuerySchema, 'query'),  getStockHistory);

module.exports = router;