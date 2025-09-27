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

const router = express.Router();

// Protect all routes
router.use(protect);

// Stock operation routes
router.post('/update-stock', updateStock);
router.post('/add-stock', addStock);
router.post('/reduce-stock', reduceStock);
router.post('/adjust-stock', adjustStock);

// History and summary routes
router.get('/summary', getStockSummary);
router.get('/recent-movements', getRecentMovements);
router.get('/history/:productId', getStockHistory);

module.exports = router;