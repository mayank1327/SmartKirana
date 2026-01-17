const salesService = require('../services/salesService');

// Create new sale
const createSale = async (req, res, next) => {
  try {
    const saleData = req.body;
    console.log(saleData);
    saleData.soldBy = req.user._id;
    console.log(saleData.soldBy); 

    const sale = await salesService.createSale(saleData);

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
    const { saleId } = req.params;
    const sale = await salesService.getSaleById(saleId);

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
    error.status = 400; // Bad Request
    next(error);
  }
};

// Get sales analytics
const getSalesAnalytics = async (req, res, next) => {
  try {
    const days = req.query.days;
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
const getTodaySales = async (req, res, next) => {
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
  getTodaySales
};