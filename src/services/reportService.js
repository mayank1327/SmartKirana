const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const StockMovement = require('../models/StockMovement');

class ReportService {
  // Get comprehensive dashboard statistics
  async getDashboardStats() {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    
    // Get current month start
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Product statistics
    const productStats = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ['$currentStock', '$minStockLevel'] }, 1, 0]
            }
          },
          outOfStockCount: {
            $sum: {
              $cond: [{ $eq: ['$currentStock', 0] }, 1, 0]
            }
          },
          totalInventoryValue: {
            $sum: { $multiply: ['$currentStock', '$costPrice'] }
          }
        }
      }
    ]);

    // Today's sales statistics
    const todaySales = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfToday, $lte: endOfToday }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalDiscount: { $sum: '$discount' },
          cashSales: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0]
            }
          },
          creditSales: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'credit'] }, '$totalAmount', 0]
            }
          }
        }
      }
    ]);

    // Monthly statistics
    const monthlySales = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          monthlyRevenue: { $sum: '$totalAmount' },
          monthlySalesCount: { $sum: 1 }
        }
      }
    ]);

    // Pending payments
    const pendingPayments = await Purchase.aggregate([
      {
        $match: {
          paymentStatus: { $in: ['pending', 'partial'] }
        }
      },
      {
        $group: {
          _id: null,
          totalPendingAmount: {
            $sum: { $subtract: ['$totalAmount', '$paidAmount'] }
          },
          pendingPurchasesCount: { $sum: 1 }
        }
      }
    ]);

    return {
      products: productStats[0] || {
        totalProducts: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        totalInventoryValue: 0
      },
      todaySales: todaySales[0] || {
        totalSales: 0,
        totalRevenue: 0,
        totalDiscount: 0,
        cashSales: 0,
        creditSales: 0
      },
      monthlySales: monthlySales[0] || {
        monthlyRevenue: 0,
        monthlySalesCount: 0
      },
      pendingPayments: pendingPayments[0] || {
        totalPendingAmount: 0,
        pendingPurchasesCount: 0
      }
    };
  }

  // Get low stock alert report
  async getLowStockReport() {
    const lowStockProducts = await Product.find({
      isActive: true,
      $expr: { $lte: ['$currentStock', '$minStockLevel'] }
    }).sort({ currentStock: 1 });

    const outOfStockProducts = await Product.find({
      isActive: true,
      currentStock: 0
    }).sort({ name: 1 });

    const criticalStockProducts = await Product.find({
      isActive: true,
      $expr: { $lt: ['$currentStock', { $multiply: ['$minStockLevel', 0.5] }] }
    }).sort({ currentStock: 1 });

    return {
      lowStockProducts,
      outOfStockProducts,
      criticalStockProducts,
      summary: {
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        criticalStockCount: criticalStockProducts.length
      }
    };
  }

  // Get daily sales summary report
  async getDailySalesReport(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Sales summary
    const salesSummary = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalDiscount: { $sum: '$discount' },
          averageSaleAmount: { $avg: '$totalAmount' }
        }
      }
    ]);

    // Top selling products
    const topProducts = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.subtotal' }
        }
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: 10 }
    ]);

    // Payment method breakdown
    const paymentBreakdown = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          amount: { $sum: '$totalAmount' }
        }
      }
    ]);

    return {
      date: date.toISOString().split('T')[0],
      summary: salesSummary[0] || {
        totalSales: 0,
        totalRevenue: 0,
        totalDiscount: 0,
        averageSaleAmount: 0
      },
      topProducts,
      paymentBreakdown
    };
  }

  // Get inventory valuation report
  async getInventoryValuation() {
    const inventoryReport = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $addFields: {
          totalCostValue: { $multiply: ['$currentStock', '$costPrice'] },
          totalSellingValue: { $multiply: ['$currentStock', '$sellingPrice'] },
          potentialProfit: {
            $multiply: [
              '$currentStock',
              { $subtract: ['$sellingPrice', '$costPrice'] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$category',
          products: {
            $push: {
              name: '$name',
              currentStock: '$currentStock',
              costPrice: '$costPrice',
              sellingPrice: '$sellingPrice',
              totalCostValue: '$totalCostValue',
              totalSellingValue: '$totalSellingValue',
              potentialProfit: '$potentialProfit'
            }
          },
          categoryTotal: { $sum: '$totalCostValue' },
          categoryProfit: { $sum: '$potentialProfit' },
          productCount: { $sum: 1 }
        }
      },
      { $sort: { categoryTotal: -1 } }
    ]);

    // Calculate overall totals
    const overallTotals = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalInventoryValue: {
            $sum: { $multiply: ['$currentStock', '$costPrice'] }
          },
          totalSellingValue: {
            $sum: { $multiply: ['$currentStock', '$sellingPrice'] }
          },
          totalPotentialProfit: {
            $sum: {
              $multiply: [
                '$currentStock',
                { $subtract: ['$sellingPrice', '$costPrice'] }
              ]
            }
          }
        }
      }
    ]);

    return {
      categoryBreakdown: inventoryReport,
      overallTotals: overallTotals[0] || {
        totalInventoryValue: 0,
        totalSellingValue: 0,
        totalPotentialProfit: 0
      }
    };
  }

  // Get profit analysis report
  async getProfitAnalysis(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Get sales with product cost information
    const profitAnalysis = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: end }
        }
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $addFields: {
          itemCost: { $multiply: ['$items.quantity', '$productInfo.costPrice'] },
          itemProfit: {
            $subtract: [
              '$items.subtotal',
              { $multiply: ['$items.quantity', '$productInfo.costPrice'] }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$items.subtotal' },
          totalCost: { $sum: '$itemCost' },
          totalProfit: { $sum: '$itemProfit' },
          totalSales: { $sum: 1 }
        }
      }
    ]);

    const result = profitAnalysis[0] || {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      totalSales: 0
    };

    // Calculate profit margin
    result.profitMargin = result.totalRevenue > 0 
      ? (result.totalProfit / result.totalRevenue) * 100 
      : 0;

    return result;
  }
}

module.exports = new ReportService();