const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');

class ReportRepository {
  // Products
  async findActiveProducts(filter = {}, options = {}) {
    const query = Product.find({ isActive: true, ...filter });
    if (options.sort) query.sort(options.sort);
    if (options.limit) query.limit(options.limit);
    return query;
  }

  async aggregateProducts(pipeline = []) {
    return Product.aggregate(pipeline);
  }

  // Sales
   async aggregateSales(pipeline = []) {
    return Sale.aggregate(pipeline);
  }

  // Purchases
  async aggregatePurchases(pipeline = []) {
    return Purchase.aggregate(pipeline);
  }
}

module.exports = new ReportRepository();