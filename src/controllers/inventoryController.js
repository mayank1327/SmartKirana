const inventoryService = require('../services/inventoryService');

// Update stock (general purpose)
const updateStock = async (req, res, next) => {
  try {
    const { productId, quantity, movementType, reason, reference, notes } = req.body;
    
    if (!productId || !quantity || !movementType || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Product ID, quantity, movement type, and reason are required'
      });
    }

    const result = await inventoryService.updateStock(
      productId, 
      quantity, 
      movementType, 
      reason, 
      req.user._id, 
      reference, 
      notes
    );

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: {
        product: result.product,
        movement: result.stockMovement
      }
    });
  } catch (error) {
    next(error);
  }
};

// Add stock (purchase/return)
const addStock = async (req, res, next) => {
  try {
    const { productId, quantity, reason, reference, notes } = req.body;

    const result = await inventoryService.addStock(
      productId, 
      quantity, 
      reason || 'purchase', 
      req.user._id, 
      reference, 
      notes
    );

    res.status(200).json({
      success: true,
      message: 'Stock added successfully',
      data: {
        product: result.product,
        movement: result.stockMovement
      }
    });
  } catch (error) {
    next(error);
  }
};

// Reduce stock (sale/damage)
const reduceStock = async (req, res, next) => {
  try {
    const { productId, quantity, reason, reference, notes } = req.body;

    const result = await inventoryService.reduceStock(
      productId, 
      quantity, 
      reason || 'sale', 
      req.user._id, 
      reference, 
      notes
    );

    res.status(200).json({
      success: true,
      message: 'Stock reduced successfully',
      data: {
        product: result.product,
        movement: result.stockMovement
      }
    });
  } catch (error) {
    next(error);
  }
};

// Adjust stock (correction)
const adjustStock = async (req, res, next) => {
  try {
    const { productId, newQuantity, reason, notes } = req.body;

    const result = await inventoryService.adjustStock(
      productId, 
      newQuantity, 
      reason || 'correction', 
      req.user._id, 
      notes
    );

    res.status(200).json({
      success: true,
      message: 'Stock adjusted successfully',
      data: {
        product: result.product,
        movement: result.stockMovement
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get stock movement history
const getStockHistory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    const result = await inventoryService.getStockHistory(productId, limit, page);

    res.status(200).json({
      success: true,
      count: result.movements.length,
      pagination: result.pagination,
      data: result.movements
    });
  } catch (error) {
    next(error);
  }
};

// Get stock summary
const getStockSummary = async (req, res, next) => {
  try {
    const summary = await inventoryService.getStockSummary();

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

// Get recent movements
const getRecentMovements = async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const movements = await inventoryService.getRecentMovements(limit);

    res.status(200).json({
      success: true,
      count: movements.length,
      data: movements
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateStock,
  addStock,
  reduceStock,
  adjustStock,
  getStockHistory,
  getStockSummary,
  getRecentMovements
};