const Product = require('../models/Product');
// const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');

class ReportRepository {
      
    findActiveProducts(filter = {}, options = {}) {
      let query = Product.find({ isActive: true, ...filter });

      if (options.sort) query = query.sort(options.sort);
      if (options.limit) query = query.limit(options.limit);

      return query; // returns Query (NOT promise)
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