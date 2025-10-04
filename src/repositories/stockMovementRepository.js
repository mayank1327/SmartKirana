const StockMovement = require('../models/StockMovement');

class StockMovementRepository {
  // CRUD
  async create(data, session = null) {
    return session 
      ? StockMovement.create([data], { session }) 
      : StockMovement.create(data);
  }

  // QUERIES
  async findAll(filter = {}, options = {}) {
    const { skip = 0, limit = 50, sort = { createdAt: -1 } } = options;
    
    return StockMovement.find(filter)
      .populate('performedBy', 'name email')
      .populate('product', 'name unit category')
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  async countDocuments(filter) {
    return StockMovement.countDocuments(filter);
  }
}

module.exports = new StockMovementRepository();