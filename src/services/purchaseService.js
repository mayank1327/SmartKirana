const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const inventoryService = require('./inventoryService');

class PurchaseService {
  // Create new purchase with automatic stock addition
  async createPurchase(purchaseData, userId) {
    const { 
      supplier, 
      items, 
      tax = 0, 
      discount = 0, 
      paymentDueDate,
      invoiceNumber,
      notes = '' 
    } = purchaseData;
    
    if (!items || items.length === 0) {
      throw new Error('Purchase must contain at least one item');
    }

    if (!supplier || !supplier.name) {
      throw new Error('Supplier information is required');
    }

    // Validate and prepare purchase items
    const purchaseItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      if (!item.unitCost || item.unitCost <= 0) {
        throw new Error(`Valid unit cost required for ${product.name}`);
      }

      const itemSubtotal = item.quantity * item.unitCost;
      
      purchaseItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitCost: item.unitCost,
        subtotal: itemSubtotal
      });
      
      subtotal += itemSubtotal;
    }

    // Calculate final amounts
    const taxAmount = (subtotal * tax) / 100;
    const totalAmount = subtotal + taxAmount - discount;

    // Create purchase record
    const purchase = await Purchase.create({
      supplier,
      items: purchaseItems,
      subtotal,
      tax: taxAmount,
      discount,
      totalAmount,
      paymentDueDate: paymentDueDate ? new Date(paymentDueDate) : null,
      invoiceNumber,
      notes,
      purchasedBy: userId
    });

    // Add stock for each item using inventory service
    for (const item of items) {
      await inventoryService.addStock(
        item.productId,
        item.quantity,
        'purchase',
        userId,
        purchase.purchaseNumber,
        `Purchase from ${supplier.name}`
      );

      // Update product cost price with latest purchase price
      await Product.findByIdAndUpdate(item.productId, {
        costPrice: item.unitCost
      });
    }

    // Populate the purchase with product details
    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('items.product', 'name category')
      .populate('purchasedBy', 'name email');

    return populatedPurchase;
  }

  // Get all purchases with filtering
  async getPurchases(query = {}) {
    const { 
      startDate, 
      endDate, 
      paymentStatus, 
      deliveryStatus,
      supplier,
      page = 1, 
      limit = 20 
    } = query;
    
    let filter = {};
    
    // Date range filter
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.$gte = new Date(startDate);
      if (endDate) filter.purchaseDate.$lte = new Date(endDate);
    }
    
    // Other filters
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (deliveryStatus) filter.deliveryStatus = deliveryStatus;
    if (supplier) filter['supplier.name'] = new RegExp(supplier, 'i');
    
    const skip = (page - 1) * limit;
    
    const purchases = await Purchase.find(filter)
      .populate('purchasedBy', 'name')
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Purchase.countDocuments(filter);
    
    return {
      purchases,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    };
  }

  // Get single purchase by ID
  async getPurchaseById(purchaseId) {
    const purchase = await Purchase.findById(purchaseId)
      .populate('items.product', 'name category sellingPrice')
      .populate('purchasedBy', 'name email');
    
    if (!purchase) {
      throw new Error('Purchase not found');
    }
    
    return purchase;
  }

  // Update payment status
  async updatePaymentStatus(purchaseId, paymentData) {
    const { paidAmount, paymentStatus, notes } = paymentData;
    
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      throw new Error('Purchase not found');
    }

    // Validate payment amount
    if (paidAmount < 0 || paidAmount > purchase.totalAmount) {
      throw new Error('Invalid payment amount');
    }

    // Update payment details
    purchase.paidAmount = paidAmount;
    purchase.paymentStatus = paymentStatus || (
      paidAmount === 0 ? 'pending' :
      paidAmount < purchase.totalAmount ? 'partial' : 'paid'
    );
    
    if (notes) purchase.notes = notes;
    
    await purchase.save();
    return purchase;
  }

  // Get pending payments summary
  async getPendingPayments() {
    const pendingPurchases = await Purchase.find({
      paymentStatus: { $in: ['pending', 'partial'] }
    })
    .select('purchaseNumber supplier totalAmount paidAmount paymentDueDate purchaseDate')
    .sort({ paymentDueDate: 1, purchaseDate: -1 });

    const summary = {
      totalPendingAmount: 0,
      overduePurchases: [],
      dueSoonPurchases: [],
      totalPurchases: pendingPurchases.length
    };

    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    pendingPurchases.forEach(purchase => {
      const remainingAmount = purchase.totalAmount - purchase.paidAmount;
      summary.totalPendingAmount += remainingAmount;

      if (purchase.paymentDueDate) {
        if (purchase.paymentDueDate < today) {
          summary.overduePurchases.push(purchase);
        } else if (purchase.paymentDueDate <= nextWeek) {
          summary.dueSoonPurchases.push(purchase);
        }
      }
    });

    return summary;
  }

  // Get supplier summary
  async getSupplierSummary() {
    const supplierStats = await Purchase.aggregate([
      {
        $group: {
          _id: '$supplier.name',
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          pendingAmount: {
            $sum: {
              $cond: [
                { $in: ['$paymentStatus', ['pending', 'partial']] },
                { $subtract: ['$totalAmount', '$paidAmount'] },
                0
              ]
            }
          },
          lastPurchaseDate: { $max: '$purchaseDate' },
          supplierInfo: { $first: '$supplier' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);

    return supplierStats;
  }

  // Get purchase analytics
  async getPurchaseAnalytics(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const analytics = await Purchase.aggregate([
      {
        $match: {
          purchaseDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$purchaseDate' }
          },
          dailyPurchases: { $sum: 1 },
          dailyAmount: { $sum: '$totalAmount' },
          dailyItems: { $sum: { $size: '$items' } }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    return analytics;
  }
}

module.exports = new PurchaseService();