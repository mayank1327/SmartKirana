const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');

class InventoryRepository {
  // Product queries for inventory context
  async findProductById(id, session = null) {
    return session ? Product.findById(id).session(session) : Product.findById(id);
  }

  async findProducts(filter){
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
      .populate('product', 'name unit category') // ← Add this
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  async countStockMovements(filter) {
    return StockMovement.countDocuments(filter);
  }

  async aggregate(pipeline) {
    return Product.aggregate(pipeline);
  }

}

module.exports = new InventoryRepository();
// Refinement consideration: If Product/StockMovement used independently elsewhere, split repositories.

// // async findStockMovements(filter, options = {}) {
//   const { skip = 0, limit = 50, sort = { createdAt: -1 }, populate = [] } = options;
  
//   let query = StockMovement.find(filter).sort(sort).skip(skip).limit(limit);
  
//   if (populate.includes('user')) {
//     query = query.populate('performedBy', 'name email');
//   }
  
//   if (populate.includes('product')) {
//     query = query.populate('product', 'name unit category');
//   }
  
//   return query;
// }

// // Usage
// repo.findStockMovements(filter, { populate: ['user', 'product'] });
// Flexible approach! Note for refinement.