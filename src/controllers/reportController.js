const reportService = require('../services/reportService');


const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const stats = await reportService.getDashboardStats(userId);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

const getLowStockReport = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const report = await reportService.getLowStockReport(userId);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

const getTodayBills = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const report = await reportService.getTodayBills(userId);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

const getWeeklyPurchases = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const report = await reportService.getWeeklyPurchases(userId);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getLowStockReport,
  getTodayBills,
  getWeeklyPurchases
};