const reportService = require('../services/reportService');

// Get dashboard statistics
const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await reportService.getDashboardStats();

    res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// Get low stock alert report
const getLowStockReport = async (req, res, next) => {
  try {
    const report = await reportService.getLowStockReport();

    res.status(200).json({
      success: true,
      message: 'Low stock report generated successfully',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// Get daily sales report
const getDailySalesReport = async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const report = await reportService.getDailySalesReport(targetDate);

    res.status(200).json({
      success: true,
      message: 'Daily sales report generated successfully',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// Get inventory valuation report
const getInventoryValuation = async (req, res, next) => {
  try {
    const report = await reportService.getInventoryValuation();

    res.status(200).json({
      success: true,
      message: 'Inventory valuation report generated successfully',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// Get profit analysis report
const getProfitAnalysis = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const report = await reportService.getProfitAnalysis(startDate, endDate);

    res.status(200).json({
      success: true,
      message: 'Profit analysis report generated successfully',
      period: { startDate, endDate },
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// Get business summary (combined key metrics)
const getBusinessSummary = async (req, res, next) => {
  try {
    // Get dashboard stats and low stock info
    const dashboardStats = await reportService.getDashboardStats();
    const lowStockInfo = await reportService.getLowStockReport();
    
    // Get today's sales report
    const todaysSales = await reportService.getDailySalesReport(new Date());

    // Combine into business summary
    const summary = {
      overview: {
        totalProducts: dashboardStats.products.totalProducts,
        lowStockAlerts: lowStockInfo.summary.lowStockCount,
        todaysSales: dashboardStats.todaySales.totalSales,
        todaysRevenue: dashboardStats.todaySales.totalRevenue,
        monthlyRevenue: dashboardStats.monthlySales.monthlyRevenue,
        pendingPayments: dashboardStats.pendingPayments.totalPendingAmount
      },
      alerts: {
        outOfStock: lowStockInfo.summary.outOfStockCount,
        criticalStock: lowStockInfo.summary.criticalStockCount,
        pendingPurchasePayments: dashboardStats.pendingPayments.pendingPurchasesCount
      },
      quickStats: {
        inventoryValue: dashboardStats.products.totalInventoryValue,
        averageSaleToday: todaysSales.summary.averageSaleAmount || 0,
        topSellingProduct: todaysSales.topProducts[0] || null
      }
    };

    res.status(200).json({
      success: true,
      message: 'Business summary generated successfully',
      timestamp: new Date(),
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

// Get alerts summary (actionable alerts)
const getAlertsSummary = async (req, res, next) => {
  try {
    const lowStockReport = await reportService.getLowStockReport();
    const dashboardStats = await reportService.getDashboardStats();

    const alerts = [];

    // Add low stock alerts
    if (lowStockReport.summary.lowStockCount > 0) {
      alerts.push({
        type: 'low_stock',
        priority: 'high',
        message: `${lowStockReport.summary.lowStockCount} products are running low on stock`,
        count: lowStockReport.summary.lowStockCount,
        action: 'Review and reorder products'
      });
    }

    // Add out of stock alerts
    if (lowStockReport.summary.outOfStockCount > 0) {
      alerts.push({
        type: 'out_of_stock',
        priority: 'critical',
        message: `${lowStockReport.summary.outOfStockCount} products are out of stock`,
        count: lowStockReport.summary.outOfStockCount,
        action: 'Immediate restocking required'
      });
    }

    // Add pending payment alerts
    if (dashboardStats.pendingPayments.totalPendingAmount > 0) {
      alerts.push({
        type: 'pending_payments',
        priority: 'medium',
        message: `₹${dashboardStats.pendingPayments.totalPendingAmount.toFixed(2)} pending in supplier payments`,
        amount: dashboardStats.pendingPayments.totalPendingAmount,
        action: 'Review and process pending payments'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Alerts summary generated successfully',
      alertCount: alerts.length,
      data: alerts
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
    getDashboardStats,
    getLowStockReport,
    getDailySalesReport,
    getInventoryValuation,
    getProfitAnalysis,
    getBusinessSummary,
    getAlertsSummary
  };