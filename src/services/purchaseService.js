const mongoose = require('mongoose');
const inventoryService = require('./inventoryService');
const purchaseRepository = require('../repositories/purchaseRepository'); // Add this
const productRepository = require('../repositories/productRepository');
const productService = require('./productService');
class PurchaseService {
  // Create new purchase with automatic stock addition
  async createPurchase(purchaseData, userId) {
  const session = await mongoose.startSession();
    return await session.withTransaction(async () => {
    const { supplierName, items, notes = '' } = purchaseData;
    
    if (!items || items.length === 0) {
      throw new Error('Purchase must contain at least one item');
    }


    // Validate and prepare purchase items
    const purchaseItems = [];
    let lineTotal = 0;

    // Fetch all products once
    let productIds = items.map(item => item.productId);

    const products = await productRepository.findMany(
         { _id: { $in: productIds } },
         session
    );

// Create lookup map
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    for (const item of items) {

      let product = productMap.get(item.productId.toString());

      // If product does not exist → auto-create it
      if (!product) {
         product = await productService.createProduct({
           name: item.productName,
           unit: item.unit,
           costPrice: item.unitCost,
           minSellingPrice: item.minSellingPrice,
           currentStock: 0,
           minStockLevel: 10,
           isActive: true
      }, session);

      console.log(product.name);
      console.log(product._id);
      // Add to map so next time loop doesn't search again
       productMap.set(product._id.toString(), product);
    }

    else if (!product.isActive) {
      // ✅ Product exists but inactive → reactivate it
      await productRepository.updateById(product._id, {
        isActive: true,
        costPrice: item.unitCost,
        minSellingPrice: item.minSellingPrice
      }, session);
      
      // Update the product object in memory
      product.isActive = true;
      product.costPrice = item.unitCost;
      product.minSellingPrice = item.minSellingPrice;
    }


    // ✅ Validate quantity
    if (!item.quantity || item.quantity <= 0) {
      throw new Error(`Valid quantity required for ${product.name}`);
    }


      if (!item.unitCost || item.unitCost <= 0) {
        throw new Error(`Valid unit cost required for ${product.name}`);
      }

      const itemlineTotal = item.quantity * item.unitCost;
       
      purchaseItems.push({
        product: product._id,
        productName: product.name,
        unit: product.unit,
        quantity: item.quantity,
        unitCost: item.unitCost,
        minSellingPrice: item.minSellingPrice, 
        lineTotal: itemlineTotal
      });
      
      lineTotal += itemlineTotal;
    }

   
    const totalAmount = lineTotal;

    // Create purchase record
    const purchase = await purchaseRepository.createPurchase({
      supplierName,
      items: purchaseItems,
      totalAmount,
      paymentMode: purchaseData.paymentMode || 'cash',
      notes,
      purchasedBy: userId,
    }, session);

     
    // Add stock for each item using inventory service
    for (const item of purchaseItems) {
      await inventoryService.addStock(
        item.product,
        item.quantity,
        'purchase',
        userId,
        purchase.purchaseNumber,
        `Purchase from ${supplierName}`,
        session
      );

      // Update product cost price with latest purchase price
      await productRepository.updateById(item.product, {
        costPrice: item.unitCost,
        minSellingPrice: item.minSellingPrice
      }, session);
    }

    // Populate the purchase with product details
    const populatedPurchase = await purchaseRepository.findById(purchase._id , [
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
      productName,
      paymentMode,
      supplierName,
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
    if (paymentMode) filter.paymentMode = paymentMode;
    if (supplierName) filter['supplierName'] = new RegExp(supplierName, 'i');

    if (productName) filter['items.productName'] = new RegExp(productName, 'i');
    
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
    const purchase = await purchaseRepository.findById(purchaseId, [
      { path: 'items.product', select: 'name sellingPrice' },
      { path: 'purchasedBy', select: 'name email' }
    ])
      
    
    if (!purchase) {
      const error = new Error('Purchase not found');
      error.status = 404;
      throw error; 
    }
    
    return purchase;
  }

  // Get supplier summary
  async getSupplierSummary() {
    const supplierStats = await purchaseRepository.aggregate([
      {
        $group: {
          _id: '$supplier.name',
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
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