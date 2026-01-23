const purchaseService = require('../services/purchaseService');

// Create new purchase
const createPurchase = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await purchaseService.createPurchase(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Purchase created successfully',
      data: {
        purchaseId: result.purchase._id,
        purchaseNumber: result.purchase.purchaseNumber,
        totalAmount: result.purchase.totalAmount,
        itemsCount: result.purchase.items.length,
        stockUpdates: result.stockUpdates,
        costPriceUpdated: result.costPriceUpdates.length > 0,
        costPriceUpdates: result.costPriceUpdates
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all purchases
const getPurchases = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await purchaseService.getPurchases(req.query, userId);

    res.status(200).json({
      success: true,
      count: result.purchases.length,
      pagination: result.pagination,
      data: result.purchases
    });
  } catch (error) {
    next(error);
  }
};

// Get single purchase
const getPurchase = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { purchaseId } = req.params;
    const purchase = await purchaseService.getPurchaseById(purchaseId, userId);

    res.status(200).json({
      success: true,
      data: purchase
    });
  } catch (error) {
    next(error);
  }
};

// Get today's purchases
const getTodaysPurchases = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const result = await purchaseService.getTodaysPurchases(userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPurchase,
  getPurchases,
  getPurchase,
  getTodaysPurchases
};