const salesService = require('../services/salesService');

// Create new sale
const createSale = async (req, res, next) => {
  try {
    const saleData = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!saleData.items || saleData.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Sale must contain at least one item'
      });
    }

    if (!saleData.paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Payment method is required'
      });
    }

    const sale = await salesService.createSale(saleData, userId);

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: sale
    });
  } catch (error) {
    next(error);
  }
};

// Get all sales
const getSales = async (req, res, next) => {
  try {
    const result = await salesService.getSales(req.query);

    res.status(200).json({
      success: true,
      count: result.sales.length,
      pagination: result.pagination,
      data: result.sales
    });
  } catch (error) {
    next(error);
  }
};

// Get single sale
const getSale = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sale = await salesService.getSaleById(id);

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    next(error);
  }
};

// Get daily sales summary
const getDailySales = async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const summary = await salesService.getDailySales(targetDate);

    res.status(200).json({
      success: true,
      date: targetDate.toISOString().split('T')[0],
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

// Get sales analytics
const getSalesAnalytics = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const analytics = await salesService.getSalesAnalytics(parseInt(days));

    res.status(200).json({
      success: true,
      period: `${days} days`,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
};

// Get today's sales (quick access)
const getTodaysSales = async (req, res, next) => {
  try {
    const today = new Date();
    const summary = await salesService.getDailySales(today);

    // Also get today's sales list
    const salesResult = await salesService.getSales({
      startDate: today.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      limit: 50
    });

    res.status(200).json({
      success: true,
      date: today.toISOString().split('T')[0],
      summary,
      sales: salesResult.sales
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSale,
  getSales,
  getSale,
  getDailySales,
  getSalesAnalytics,
  getTodaysSales
};