const mongoose = require('mongoose');
const reportRepository = require('../repositories/reportRepository');
const TemporaryProduct = require('../models/TemporaryProduct');
const { formatStockDisplay } = require('../utils/stockUtils');

class ReportService {

  async getDashboardStats(userId) {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
  
    const [productStats, todayBills, weeklyPurchases, pendingTempCount] = await Promise.all([
  
      // Product stats — low stock + out of stock count
      reportRepository.aggregateProducts([
        { $match: { isActive: true, userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            lowStockCount: {
              $sum: {
                $cond: [{
                  $and: [
                    { $ne: ['$minStockLevel', null] },
                    { $gt: ['$currentStock', 0] },
                    { $lte: ['$currentStock', '$minStockLevel'] }
                  ]
                }, 1, 0]
              }
            },
            outOfStockCount: {
              $sum: {
                $cond: [{ $lte: ['$currentStock', 0] }, 1, 0]
              }
            }
          }
        }
      ]),
  
      // Today's bills
      reportRepository.aggregateBills([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            billDate: { $gte: startOfToday, $lte: endOfToday }
          }
        },
        {
          $group: {
            _id: null,
            totalBills: { $sum: 1 },
            totalRevenue: { $sum: '$finalTotal' }
          }
        }
      ]),
  
      // Weekly purchases
      reportRepository.aggregatePurchases([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            purchaseDate: { $gte: startOfWeek }
          }
        },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: 1 }
          }
        }
      ]),
  
      // Pending temp products
      TemporaryProduct.countDocuments({ userId, isPendingSetup: true })
    ]);
  
    return {
      todayBills: todayBills[0] || { totalBills: 0, totalRevenue: 0 },
      weeklyPurchases: weeklyPurchases[0] || { totalPurchases: 0 },
      stockAlerts: {
        lowStockCount: productStats[0]?.lowStockCount || 0,
        outOfStockCount: productStats[0]?.outOfStockCount || 0,
        totalAlerts: (productStats[0]?.lowStockCount || 0) + (productStats[0]?.outOfStockCount || 0)
      },
      pendingTempProductsCount: pendingTempCount
    };
  }

  async getLowStockReport(userId) {
    const [outOfStockProducts, lowStockProducts] = await Promise.all([
  
      // Out of stock — currentStock <= 0
      reportRepository.findActiveProducts({
        userId: new mongoose.Types.ObjectId(userId),
        currentStock: { $lte: 0 }
      }),
  
      // Low stock — 0 se zyada lekin minStockLevel se kam ya barabar
      reportRepository.findActiveProducts({
        userId: new mongoose.Types.ObjectId(userId),
        minStockLevel: { $ne: null },
        $expr: {
          $and: [
            { $gt: ['$currentStock', 0] },
            { $lte: ['$currentStock', '$minStockLevel'] }
          ]
        }
      })
    ]);
  
    const formatProduct = (product) => ({
      productId: product._id,
      productName: product.productName,
      currentStock: product.currentStock,
      minStockLevel: product.minStockLevel,
      stockDisplay: formatStockDisplay(product)
    });
  
    return {
      outOfStock: outOfStockProducts.map(formatProduct),
      lowStock: lowStockProducts.map(formatProduct),
      summary: {
        outOfStockCount: outOfStockProducts.length,
        lowStockCount: lowStockProducts.length
      }
    };
  }

  async getTodayBills(userId) {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  
    const bills = await reportRepository.aggregateBills([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          billDate: { $gte: startOfToday, $lte: endOfToday }
        }
      },
      {
        $project: {
          billNumber: 1,
          billDate: 1,
          customerName: 1,
          finalTotal: 1,
          itemsCount: { $size: '$items' },
          createdAt: 1
        }
      },
      { $sort: { billDate: -1 } }
    ]);
  
    const totalRevenue = bills.reduce((sum, b) => sum + b.finalTotal, 0);
  
    return {
      summary: {
        totalBills: bills.length,
        totalRevenue
      },
      bills: bills.map(b => ({
        billId: b._id,
        billNumber: b.billNumber,
        customerName: b.customerName || 'Walk-in',
        finalTotal: b.finalTotal,
        itemsCount: b.itemsCount,
        billDate: b.billDate
      }))
    };
  }
  
  async getWeeklyPurchases(userId) {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
  
    const purchases = await reportRepository.aggregatePurchases([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          purchaseDate: { $gte: startOfWeek }
        }
      },
      {
        $project: {
          purchaseNumber: 1,
          purchaseDate: 1,
          supplierName: 1,
          totalAmount: 1,
          itemsCount: { $size: '$items' },
          createdAt: 1
        }
      },
      { $sort: { purchaseDate: -1 } }
    ]);
  
    return {
      summary: {
        totalPurchases: purchases.length
      },
      purchases: purchases.map(p => ({
        purchaseId: p._id,
        purchaseNumber: p.purchaseNumber,
        supplierName: p.supplierName || 'N/A',
        totalAmount: p.totalAmount,
        itemsCount: p.itemsCount,
        purchaseDate: p.purchaseDate
      }))
    };
  }

}

module.exports = new ReportService();