const mongoose = require('mongoose');
const inventoryService = require('./inventoryService');
const purchaseRepository = require('../repositories/purchaseRepository'); // Add this

class PurchaseService {
  // Create new purchase with automatic stock addition
  async createPurchase(purchaseData, userId) {
  const session = await mongoose.startSession();
    return await session.withTransaction(async () => {
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

    // Fetch all products once
    const productIds = items.map(item => item.productId);
    const products = await purchaseRepository.findProducts(
         { _id: { $in: productIds }, isActive: true },
         session
    );

// Create lookup map
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    for (const item of items) {

      const product = productMap.get(item.productId);

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
    const purchase = await purchaseRepository.createPurchase({
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
    }, session);

    // Add stock for each item using inventory service
    for (const item of items) {
      await inventoryService.addStock(
        item.productId,
        item.quantity,
        'purchase',
        userId,
        purchase.purchaseNumber,
        `Purchase from ${supplier.name}`,
        session
      );

      // Update product cost price with latest purchase price
      await purchaseRepository.updateProductById(item.productId, {
        costPrice: item.unitCost
      }, session);
    }

    // Populate the purchase with product details
    const populatedPurchase = await purchaseRepository.findPurchaseById(purchase._id , [
      { path: 'items.product', select: 'name category' },
      { path: 'purchasedBy', select: 'name email' }
    ], session);
     
    return populatedPurchase;
  }).finally(() => session.endSession());
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
    
    const purchases = await purchaseRepository.findPurchases(filter, {
      skip,
      limit: parseInt(limit),
      sort: { purchaseDate: -1 },
      populate: [{ path: 'purchasedBy', select: 'name' }]
    })
    
    const total = await purchaseRepository.countDocuments(filter);
    
    return {
      purchases,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    }
  }

  // Get single purchase by ID
  async getPurchaseById(purchaseId) {
    const purchase = await purchaseRepository.findPurchaseById(purchaseId, [
      { path: 'items.product', select: 'name category sellingPrice' },
      { path: 'purchasedBy', select: 'name email' }
    ])
      
    
    if (!purchase) {
      throw new Error('Purchase not found');
    }
    
    return purchase;
  }

  // Update payment status // here we also adding transaction session 
  async updatePaymentStatus(purchaseId, paymentData, session = null) {
    const { paidAmount, paymentStatus, notes } = paymentData;

    const ownSession = !session;
    session = session || await mongoose.startSession();
    
    try {
    return await session.withTransaction(async () => {
    const purchase = await purchaseRepository.findPurchaseById(purchaseId, [], session);
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
    
    await purchaseRepository.save(purchase, session);
    return purchase;
  });
    } finally {
      if (ownSession) session.endSession();
    }
  }

  // Get pending payments summary
  async getPendingPayments() {
    const pendingPurchases = await purchaseRepository.findPurchases(
      { paymentStatus: { $in: ['pending', 'partial'] } },
      'purchaseNumber supplier totalAmount paidAmount paymentDueDate purchaseDate',
      { paymentDueDate: 1, purchaseDate: -1 }
    )
    

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
    const supplierStats = await purchaseRepository.aggregate([
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
    
    const analytics = await purchaseRepository.aggregate([
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

  async getTodaysPurchaseSummary() {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    const [result, aggregate] = await Promise.all([
      this.getPurchases({ startDate: todayString, endDate: todayString, limit: 50 }),
      purchaseRepository.aggregate([
        { $match: {
          purchaseDate: {
            $gte: new Date(todayString),
            $lte: new Date(todayString + 'T23:59:59.999Z')
          }
        }},
        { $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalItems: { $sum: { $size: '$items' } }
        }}
      ])
    ]);
    
    return {
      date: todayString,
      summary: aggregate[0] || { totalPurchases: 0, totalAmount: 0, totalItems: 0 },
      purchases: result.purchases
    };
  }
}

module.exports = new PurchaseService();