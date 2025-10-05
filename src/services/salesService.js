const mongoose = require('mongoose');
const inventoryService = require('./inventoryService');
const salesRepository = require('../repositories/salesRepository');
const productRepository = require('../repositories/productRepository');

class SalesService {
  // Create new sale with automatic stock deduction
  async createSale(saleData, userId) {
    const session = await mongoose.startSession();
    return await session.withTransaction(async () => {

    const { items, customerInfo, paymentMethod, tax = 0, discount = 0, creditAmount = 0, notes = '' } = saleData;
    
    if (!items || items.length === 0) {
      throw new Error('Sale must contain at least one item');
    }

    // Fetch all products once
    const productIds = items.map(item => item.productId);

    const products = await productRepository.findById(
      { _id: { $in: productIds }, isActive: true },
      session
    );

    // Create lookup map
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

     // Validate using map
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }
      if (product.currentStock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.currentStock}, Required: ${item.quantity}`);
      }
    }

     // Prepare sale items with totals
     const saleItems = items.map(item => {
      const product = productMap.get(item.productId);
      const itemSubtotal = item.quantity * product.sellingPrice;
      return {
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.sellingPrice,
        subtotal: itemSubtotal
      };
    });
    // Calculate subtotal for the sale 
    const subtotal = saleItems.reduce((sum, item) => sum + item.subtotal, 0);


    // Validate tax, discount, and creditAmount
    if (tax < 0 || tax > 100) {
      throw new Error('Tax percentage must be between 0 and 100');
    }
    
    if (discount < 0 || discount > subtotal) {
      throw new Error('Discount cannot exceed subtotal');
    }
    
    if (creditAmount < 0 || creditAmount > totalAmount) {
      throw new Error('Credit amount cannot exceed total amount');
    }
   
    // Calculate final amounts
    const taxAmount = (subtotal * tax) / 100;
    const totalAmount = subtotal + taxAmount - discount;

    // Create sale record
    const sale = await salesRepository.createSale({
      items: saleItems,
      subtotal,
      tax: taxAmount,
      discount,
      totalAmount,
      paymentMethod,
      paymentStatus: creditAmount > 0 ? 'partial' : 'paid',
      customerInfo,
      creditAmount,
      notes,
      soldBy: userId
    }, session);

    // Reduce stock for each item using inventory service
    for (const item of items) {
      await inventoryService.reduceStock(
        item.productId,
        item.quantity,
        'sale',
        userId,
        sale.saleNumber,
        `Sale to ${customerInfo?.name || 'Customer'}`,
        session
      );
    }

    // Populate the sale with product details
    const populatedSale = await salesRepository.findSaleById(sale._id, [
      {path : 'items.product', select : 'name category'},
      {path : 'soldBy', select : 'name email'}
    ], session);

    return populatedSale;
  }).finally(() => session.endSession());
}

  // Get all sales with filtering
  async getSales(query = {}) {
    const { 
      startDate, 
      endDate, 
      paymentMethod, 
      paymentStatus, 
      soldBy,
      page = 1, 
      limit = 20 
    } = query;
    
    let filter = {};
    
    // Date range filter
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }
    
    // Other filters
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (soldBy) filter.soldBy = soldBy;
    
    const skip = (page - 1) * limit;
    
    const sales = await salesRepository.findSales(filter,{
    skip,
    limit: parseInt(limit),
    sort: { saleDate: -1 },
    populate: [{ path: 'soldBy', select: 'name' }]
  });
    
    const total = await salesRepository.countDocuments(filter);
    
    return {
      sales,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    };
  }

  // Get single sale by ID
  async getSaleById(saleId) {
    const sale = await salesRepository.findSaleById(saleId, [
      {path : 'items.product', select : 'name category costPrice'},
      {path : 'soldBy', select : 'name email'}
    ]);

    if (!sale) {
      throw new Error('Sale not found');
    }
    
    return sale;
  }

  // Get daily sales summary
  async getDailySales(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const dailySales = await salesRepository.aggregate([
      {
        $match: {
          saleDate: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalDiscount: { $sum: '$discount' },
          totalCreditAmount: { $sum: '$creditAmount' },
          cashSales: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0]
            }
          },
          cardSales: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$totalAmount', 0]
            }
          },
          upiSales: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'upi'] }, '$totalAmount', 0]
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

    return dailySales[0] || {
      totalSales: 0,
      totalAmount: 0,
      totalDiscount: 0,
      totalCreditAmount: 0,
      cashSales: 0,
      cardSales: 0,
      upiSales: 0,
      creditSales: 0
    };
  }

  // Get sales analytics
  async getSalesAnalytics(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const analytics = await salesRepository.aggregate([
      {
        $match: {
          saleDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$saleDate' }
          },
          dailySales: { $sum: 1 },
          dailyAmount: { $sum: '$totalAmount' },
          dailyDiscount: { $sum: '$discount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    return analytics;
  }
}

module.exports = new SalesService();

// Optimizations Needed:

// Batch product fetching - One query instead of N
// Payment status logic - Handle full credit case
// Validation - Tax/discount/credit amount ranges
// Error messages - More specific (which item failed)
