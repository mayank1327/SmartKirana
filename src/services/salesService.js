const mongoose = require('mongoose');
const inventoryService = require('./inventoryService');
const salesRepository = require('../repositories/salesRepository');
const productRepository = require('../repositories/productRepository');

class SalesService {
  // Create new sale with automatic stock deduction
  async createSale(saleData) {
    const session = await mongoose.startSession();
    return await session.withTransaction(async () => {

    const { items, customerName, paymentMethod, soldBy } = saleData;
    
    if (!items || items.length === 0) {
      throw new Error('Sale must contain at least one item');
    }

    // Fetch all products once
    const productIds = items.map(item => item.productId);

    const products = await productRepository.findMany(
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
      console.log(item.quantity, product.currentStock);
      if (product.currentStock < item.quantity) {
        
        const error = new Error(`Insufficient stock`);
        error.status = 400;
        throw error;
      }
    }

     // Prepare sale items with totals
     const saleItems = items.map(item => {
      const product = productMap.get(item.productId);
      const itemLineTotal = item.quantity * item.unitPrice;
      return {
        product: product._id,
        productName: product.name,
        unit: product.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: itemLineTotal
      };
    });

    const totalAmount = saleItems.reduce((sum, i) => sum + i.lineTotal, 0);

    // Create sale record
    const sale = await salesRepository.createSale({
      items: saleItems,
      totalAmount,
      paymentMethod,
      customerName,
      soldBy
    }, session);

    // Reduce stock for each item using inventory service
    for (const item of items) {
      await inventoryService.reduceStock(
        item.productId,
        item.quantity,
        'sale',
        soldBy,
        sale.saleNumber,
        `Sale to ${customerName || 'Customer'}`,
        session
      );
    }

    // Populate the sale with product details
    const populatedSale = await salesRepository.findSaleById(sale._id,
      {path : 'items.product', select : 'name'}, 
      session);

    return populatedSale;
  }).finally(() => session.endSession());
}

  // Get all sales with filtering
  async getSales(query = {}) {
    const { 
      startDate, 
      endDate, 
      paymentMethod, 
      soldBy,
      page = 1, 
      limit = 20 
    } = query;
    
    let filter = {};
    // Date range filter
  if (startDate || endDate) {
    filter.saleDate = {};
    if (startDate) {
      // ✅ Set to start of day (00:00:00.000)
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filter.saleDate.$gte = start;
    }
    if (endDate) {
      // ✅ Set to end of day (23:59:59.999)
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.saleDate.$lte = end;
    }
  }
    
    // Other filters
    if (paymentMethod) filter.paymentMethod = paymentMethod;
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
    console.log('Fetching sale with ID:', saleId); // ✅ Debug log
    const sale = await salesRepository.findSaleById(saleId, [
      {path : 'items.product', select : 'name costPrice'},
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
          cashSales: {
            $sum: {
              $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$totalAmount', 0]
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
      cashSales: 0,
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


