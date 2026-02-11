const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
// const Sale = require('../models/Sale');

class AlertService {
  // Generate all alerts for the system
  async generateAllAlerts() {
    const alerts = [];
    
    // Get low stock alerts
    const lowStockAlerts = await this.getLowStockAlerts();
    alerts.push(...lowStockAlerts);
    
    // Get payment due alerts
    const paymentAlerts = await this.getPaymentDueAlerts();
    alerts.push(...paymentAlerts);
    
    // Get business performance alerts
    const performanceAlerts = await this.getPerformanceAlerts();
    alerts.push(...performanceAlerts);
    
    return alerts;
  }

  // Low stock and out of stock alerts
  async getLowStockAlerts() {
    const alerts = [];
    
    // Critical stock (less than 50% of minimum)
    const criticalStock = await Product.find({
      isActive: true,
      $expr: { 
        $and: [
          { $gt: ['$currentStock', 0] },
          { $lt: ['$currentStock', { $multiply: ['$minStockLevel', 0.5] }] }
        ]
      }
    }).select('name currentStock minStockLevel category');

    if (criticalStock.length > 0) {
      alerts.push({
        id: 'critical_stock',
        type: 'inventory',
        priority: 'critical',
        title: 'Critical Stock Alert',
        message: `${criticalStock.length} products are critically low on stock`,
        details: criticalStock.map(p => ({
          product: p.name,
          current: p.currentStock,
          minimum: p.minStockLevel,
          category: p.category
        })),
        actionRequired: true,
        recommendations: [
          'Immediate restocking required',
          'Consider emergency purchase orders',
          'Review supplier delivery times'
        ],
        createdAt: new Date()
      });
    }

    // Out of stock alerts
    const outOfStock = await Product.find({
      isActive: true,
      currentStock: 0
    }).select('name category minStockLevel');

    if (outOfStock.length > 0) {
      alerts.push({
        id: 'out_of_stock',
        type: 'inventory',
        priority: 'critical',
        title: 'Out of Stock Alert',
        message: `${outOfStock.length} products are completely out of stock`,
        details: outOfStock.map(p => ({
          product: p.name,
          category: p.category,
          recommendedOrder: p.minStockLevel * 2
        })),
        actionRequired: true,
        recommendations: [
          'Place urgent purchase orders',
          'Inform customers about unavailability',
          'Find alternative suppliers if needed'
        ],
        createdAt: new Date()
      });
    }

    // Low stock warnings (at or below minimum level)
    const lowStock = await Product.find({
      isActive: true,
      $expr: { 
        $and: [
          { $gt: ['$currentStock', 0] },
          { $lte: ['$currentStock', '$minStockLevel'] },
          { $gte: ['$currentStock', { $multiply: ['$minStockLevel', 0.5] }] }
        ]
      }
    }).select('name currentStock minStockLevel category');

    if (lowStock.length > 0) {
      alerts.push({
        id: 'low_stock',
        type: 'inventory',
        priority: 'high',
        title: 'Low Stock Warning',
        message: `${lowStock.length} products need restocking soon`,
        details: lowStock.map(p => ({
          product: p.name,
          current: p.currentStock,
          minimum: p.minStockLevel,
          category: p.category
        })),
        actionRequired: false,
        recommendations: [
          'Plan restocking in next few days',
          'Check supplier availability',
          'Review sales patterns for better planning'
        ],
        createdAt: new Date()
      });
    }

    return alerts;
  }

  // Payment due alerts for purchases
  async getPaymentDueAlerts() {
    const alerts = [];
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    // Overdue payments
    const overduePurchases = await Purchase.find({
      paymentStatus: { $in: ['pending', 'partial'] },
      paymentDueDate: { $lt: today }
    }).select('purchaseNumber supplier totalAmount paidAmount paymentDueDate');

    if (overduePurchases.length > 0) {
      const totalOverdueAmount = overduePurchases.reduce(
        (sum, purchase) => sum + (purchase.totalAmount - purchase.paidAmount), 0
      );

      alerts.push({
        id: 'overdue_payments',
        type: 'finance',
        priority: 'critical',
        title: 'Overdue Payments Alert',
        message: `₹${totalOverdueAmount.toFixed(2)} in overdue supplier payments`,
        details: overduePurchases.map(p => ({
          purchaseNumber: p.purchaseNumber,
          supplier: p.supplier.name,
          overdueAmount: p.totalAmount - p.paidAmount,
          dueDate: p.paymentDueDate,
          daysOverdue: Math.floor((today - p.paymentDueDate) / (1000 * 60 * 60 * 24))
        })),
        actionRequired: true,
        recommendations: [
          'Contact suppliers to discuss payment',
          'Prioritize critical supplier payments',
          'Review cash flow and payment schedule'
        ],
        createdAt: new Date()
      });
    }

    // Payments due soon
    const dueSoonPurchases = await Purchase.find({
      paymentStatus: { $in: ['pending', 'partial'] },
      paymentDueDate: { $gte: today, $lte: nextWeek }
    }).select('purchaseNumber supplier totalAmount paidAmount paymentDueDate');

    if (dueSoonPurchases.length > 0) {
      const totalDueSoonAmount = dueSoonPurchases.reduce(
        (sum, purchase) => sum + (purchase.totalAmount - purchase.paidAmount), 0
      );

      alerts.push({
        id: 'payments_due_soon',
        type: 'finance',
        priority: 'medium',
        title: 'Payments Due Soon',
        message: `₹${totalDueSoonAmount.toFixed(2)} in payments due within 7 days`,
        details: dueSoonPurchases.map(p => ({
          purchaseNumber: p.purchaseNumber,
          supplier: p.supplier.name,
          dueAmount: p.totalAmount - p.paidAmount,
          dueDate: p.paymentDueDate,
          daysRemaining: Math.floor((p.paymentDueDate - today) / (1000 * 60 * 60 * 24))
        })),
        actionRequired: false,
        recommendations: [
          'Plan payment schedule',
          'Ensure sufficient cash flow',
          'Confirm payment methods with suppliers'
        ],
        createdAt: new Date()
      });
    }

    return alerts;
  }

  // Business performance alerts
  async getPerformanceAlerts() {
    const alerts = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if there were no sales yesterday
    const yesterdaySalesCount = await Sale.countDocuments({
      saleDate: {
        $gte: new Date(yesterday.setHours(0, 0, 0, 0)),
        $lte: new Date(yesterday.setHours(23, 59, 59, 999))
      }
    });

    if (yesterdaySalesCount === 0) {
      alerts.push({
        id: 'no_sales_yesterday',
        type: 'business',
        priority: 'medium',
        title: 'No Sales Yesterday',
        message: 'No sales were recorded yesterday',
        details: {
          date: yesterday.toISOString().split('T')[0],
          recommendation: 'Review business operations and customer traffic'
        },
        actionRequired: false,
        recommendations: [
          'Check if system was working properly',
          'Review yesterday\'s operations',
          'Consider promotional activities'
        ],
        createdAt: new Date()
      });
    }

    // Check for high discount usage (over 15% of sales amount)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const discountAnalysis = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: last7Days }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          totalDiscount: { $sum: '$discount' }
        }
      }
    ]);

    if (discountAnalysis.length > 0) {
      const discountPercentage = (discountAnalysis[0].totalDiscount / discountAnalysis[0].totalSales) * 100;
      
      if (discountPercentage > 15) {
        alerts.push({
          id: 'high_discount_usage',
          type: 'business',
          priority: 'low',
          title: 'High Discount Usage',
          message: `Discounts account for ${discountPercentage.toFixed(1)}% of sales in last 7 days`,
          details: {
            period: '7 days',
            discountPercentage: discountPercentage.toFixed(1),
            totalDiscount: discountAnalysis[0].totalDiscount,
            totalSales: discountAnalysis[0].totalSales
          },
          actionRequired: false,
          recommendations: [
            'Review discount policy',
            'Analyze impact on profit margins',
            'Consider adjusting discount strategy'
          ],
          createdAt: new Date()
        });
      }
    }

    return alerts;
  }

  // Get alerts summary for quick overview
  async getAlertsSummary() {
    const allAlerts = await this.generateAllAlerts();
    
    const summary = {
      total: allAlerts.length,
      critical: allAlerts.filter(a => a.priority === 'critical').length,
      high: allAlerts.filter(a => a.priority === 'high').length,
      medium: allAlerts.filter(a => a.priority === 'medium').length,
      low: allAlerts.filter(a => a.priority === 'low').length,
      actionRequired: allAlerts.filter(a => a.actionRequired).length,
      byType: {
        inventory: allAlerts.filter(a => a.type === 'inventory').length,
        finance: allAlerts.filter(a => a.type === 'finance').length,
        business: allAlerts.filter(a => a.type === 'business').length
      }
    };

    return {
      summary,
      alerts: allAlerts
    };
  }
}

module.exports = new AlertService();