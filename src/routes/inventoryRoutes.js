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
const inventoryValidation = require('../validators/inventoryValidator');

const router = express.Router();

// Protect all routes
router.use(protect);  // TODO : Role-based access control can be added here

// Stock operation routes
router.post('/update-stock', validate(inventoryValidation.updateStock),updateStock);
router.post('/add-stock', validate(inventoryValidation.addStock),addStock);
router.post('/reduce-stock', validate(inventoryValidation.reduceStock),reduceStock);
router.post('/adjust-stock', validate(inventoryValidation.adjustStock),adjustStock);

// History and summary routes
router.get('/summary', getStockSummary);
router.get('/recent-movements', validate(inventoryValidation.recentMovementsQuery, 'query'),getRecentMovements);
router.get('/history/:productId', validate(inventoryValidation.getStockHistoryQuery, 'query'),  getStockHistory);

module.exports = router;