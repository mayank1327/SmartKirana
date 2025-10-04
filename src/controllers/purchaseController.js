const purchaseService = require('../services/purchaseService');

// Create new purchase
const createPurchase = async (req, res, next) => {
  try {
    const purchaseData = req.body;
    const userId = req.user._id;

    const purchase = await purchaseService.createPurchase(purchaseData, userId);

    res.status(201).json({
      success: true,
      message: 'Purchase created successfully',
      data: purchase
    });
  } catch (error) {
    next(error);
  }
};

// Get all purchases
const getPurchases = async (req, res, next) => {
  try {
    const result = await purchaseService.getPurchases(req.query);

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
    const { id } = req.params;
    const purchase = await purchaseService.getPurchaseById(id);

    res.status(200).json({
      success: true,
      data: purchase
    });
  } catch (error) {
    
    next(error);
  }
};

// Update payment status
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const paymentData = req.body;

    const purchase = await purchaseService.updatePaymentStatus(id, paymentData);

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: purchase
    });
  } catch (error) {
    next(error);
  }
};

// Get pending payments
const getPendingPayments = async (req, res, next) => {
  try {
    const summary = await purchaseService.getPendingPayments();

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

// Get supplier summary
const getSupplierSummary = async (req, res, next) => {
  try {
    const summary = await purchaseService.getSupplierSummary();

    res.status(200).json({
      success: true,
      count: summary.length,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

// Get purchase analytics
const getPurchaseAnalytics = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const analytics = await purchaseService.getPurchaseAnalytics(parseInt(days));

    res.status(200).json({
      success: true,
      period: `${days} days`,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
};

// Get today's purchases (quick access)
const getTodaysPurchases = async (req, res, next) => {
  try {
    const result = await purchaseService.getTodaysPurchases();

    res.status(200).json({
      success: true,
      date: todayString,
      summary,
      purchases: result.purchases
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPurchase,
  getPurchases,
  getPurchase,
  updatePaymentStatus,
  getPendingPayments,
  getSupplierSummary,
  getPurchaseAnalytics,
  getTodaysPurchases
};