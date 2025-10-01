const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');

class InventoryRepository {
  // Product queries for inventory context
  async findProductById(id, session = null) {
    return session ? Product.findById(id).session(session) : Product.findById(id);
  }

  async findProduct(filter){
      return Product.find(filter);
  }

  async save(product, session = null) {
    return product.save({ session });
  }


  async createStockMovement(data, session = null) { 
    return session ? StockMovement.create([data], { session }) : StockMovement.create(data);
  }

  async findStockMovements(filter, options = {}) {
    const { skip = 0, limit = 50, sort = { createdAt: -1 } } = options;
    return StockMovement.find(filter)
      .populate('performedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  async countStockMovements(filter) {
    return StockMovement.countDocuments(filter);
  }

}

module.exports = new InventoryRepository();