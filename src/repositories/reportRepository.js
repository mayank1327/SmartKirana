const Product = require('../models/Product');
const Bill = require('../models/Bill');
const Purchase = require('../models/Purchase');

class ReportRepository {

  async findActiveProducts(filter = {}, options = {}) {
    let query = Product.find(filter);
    if (options.sort) query = query.sort(options.sort);
    if (options.limit) query = query.limit(options.limit);
    return query.exec();
  }

  async aggregateProducts(pipeline = []) {
    return Product.aggregate(pipeline);
  }

  async aggregateBills(pipeline = []) {
    return Bill.aggregate(pipeline);
  }

  async aggregatePurchases(pipeline = []) {
    return Purchase.aggregate(pipeline);
  }
}

module.exports = new ReportRepository();