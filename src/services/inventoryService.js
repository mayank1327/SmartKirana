const mongoose = require('mongoose'); // For transactions if needed
const productRepository = require('../repositories/productRepository');
const stockMovementRepository = require('../repositories/stockMovementRepository');

class InventoryService {
  // Update stock with movement tracking
  async updateStock(productId, quantity, movementType, reason, userId, reference = '', notes = '', session = null) {
    const ownSession = !session;
    session = session ? session : await mongoose.startSession();
    try {
    return await session.withTransaction(async () => {
    const product = await productRepository.findById(productId, session);
    if (!product || !product.isActive) {
      throw new Error('Product not found');
    }

    const previousStock = product.currentStock;
    let newStock;

    // Calculate new stock based on movement type
    if (movementType === 'IN') {
      newStock = previousStock + quantity;
    } else if (movementType === 'OUT') {
      newStock = previousStock - quantity;
      
      // Prevent negative stock
      if (newStock < 0) {
        throw new Error(`Insufficient stock. Available: ${previousStock}, Required: ${quantity}`);
      }
    } else if (movementType === 'ADJUSTMENT') {
      if (quantity < 0) { // Stock can be 0 (out of stock) but not negative!
        throw new Error('Adjustment quantity cannot be negative');
      }
         newStock = quantity; // Direct stock adjustment
    }

    // Update product stock
    product.currentStock = newStock;
    product.isLowStock = newStock <= product.minStockLevel; // Update low stock flag
    await productRepository.save(product, session);

    // Create stock movement record
    const stockMovement = await stockMovementRepository.create({
      product: productId,
      movementType,
      quantity: movementType === 'ADJUSTMENT' ? Math.abs(newStock - previousStock) : quantity,
      previousStock,
      newStock,
      reason,
      reference,
      notes,
      performedBy: userId
    }, session);

    return {
      product,
      stockMovement
    };
  
  });
} finally {
  if (ownSession)
   session.endSession();
}
}

  // Add stock (purchase/return)
  async addStock(productId, quantity, reason, userId, reference = '', notes = '', session = null) {
    return this.updateStock(productId, quantity, 'IN', reason, userId, reference, notes, session);
  }

  // Reduce stock (sale/damage)
  async reduceStock(productId, quantity, reason, userId, reference = '', notes = '', session = null) {
    return this.updateStock(productId, quantity, 'OUT', reason, userId, reference, notes, session);
  }

  // Adjust stock (correction)
  async adjustStock(productId, newQuantity, reason, userId, notes = '') {
    return this.updateStock(productId, newQuantity, 'ADJUSTMENT', reason, userId, 'Stock Adjustment', notes);
  }

  // Get stock movement history for a product
  async getStockHistory(productId, limit = 20, page = 1) {
    const skip = (page - 1) * limit;
    
    const movements = await stockMovementRepository.findAll(
      { product: productId }, 
      { skip, limit: parseInt(limit), sort: { createdAt: -1 } }
    )

    const total = await stockMovementRepository.countDocuments({ product: productId });

    return {
      movements,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    };
  }

  // Get stock summary for all products
  async getStockSummary() {
    const summary = await productRepository.aggregate([
      { $match: { isActive: true } },
      { $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        lowStockCount: { 
          $sum: { $cond: [{ $lte: ['$currentStock', '$minStockLevel'] }, 1, 0] }
        },
        outOfStockCount: { 
          $sum: { $cond: [{ $eq: ['$currentStock', 0] }, 1, 0] }
        },
        totalStockValue: { 
          $sum: { $multiply: ['$currentStock', '$costPrice'] }
        }
      }}
    ]);
    
    const categoryBreakdown = await productRepository.aggregate([
      { $match: { isActive: true } },
      { $group: {
        _id: '$category',
        count: { $sum: 1 },
        stockValue: { $sum: { $multiply: ['$currentStock', '$costPrice'] } }
      }}
    ]);
    
    return { ...summary[0], categoryBreakdown };
  }

  // Get recent stock movements (all products)
  async getRecentMovements(limit = 50) {
  const movements = await stockMovementRepository.findAll(
      {}, // No filter (all products)
    { 
      limit: parseInt(limit), 
      sort: { createdAt: -1 },
      populate: ['product', 'performedBy'] // If you add this option
    }
   );
     return movements;
  }
}

module.exports = new InventoryService();