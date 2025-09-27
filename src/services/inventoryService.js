const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');

class InventoryService {
  // Update stock with movement tracking
  async updateStock(productId, quantity, movementType, reason, userId, reference = '', notes = '') {
    const product = await Product.findById(productId);
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
      newStock = quantity; // Direct stock adjustment
    }

    // Update product stock
    product.currentStock = newStock;
    await product.save();

    // Create stock movement record
    const stockMovement = await StockMovement.create({
      product: productId,
      movementType,
      quantity: movementType === 'ADJUSTMENT' ? Math.abs(newStock - previousStock) : quantity,
      previousStock,
      newStock,
      reason,
      reference,
      notes,
      performedBy: userId
    });

    return {
      product,
      stockMovement
    };
  }

  // Add stock (purchase/return)
  async addStock(productId, quantity, reason, userId, reference = '', notes = '') {
    return this.updateStock(productId, quantity, 'IN', reason, userId, reference, notes);
  }

  // Reduce stock (sale/damage)
  async reduceStock(productId, quantity, reason, userId, reference = '', notes = '') {
    return this.updateStock(productId, quantity, 'OUT', reason, userId, reference, notes);
  }

  // Adjust stock (correction)
  async adjustStock(productId, newQuantity, reason, userId, notes = '') {
    return this.updateStock(productId, newQuantity, 'ADJUSTMENT', reason, userId, 'Stock Adjustment', notes);
  }

  // Get stock movement history for a product
  async getStockHistory(productId, limit = 20, page = 1) {
    const skip = (page - 1) * limit;
    
    const movements = await StockMovement.find({ product: productId })
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await StockMovement.countDocuments({ product: productId });

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
    const products = await Product.find({ isActive: true })
      .select('name currentStock minStockLevel category')
      .sort({ name: 1 });

    const summary = {
      totalProducts: products.length,
      lowStockCount: products.filter(p => p.currentStock <= p.minStockLevel).length,
      outOfStockCount: products.filter(p => p.currentStock === 0).length,
      totalStockValue: 0,
      categoryBreakdown: {}
    };

    // Calculate stock value and category breakdown
    for (const product of products) {
      const stockValue = product.currentStock * product.costPrice || 0;
      summary.totalStockValue += stockValue;

      if (!summary.categoryBreakdown[product.category]) {
        summary.categoryBreakdown[product.category] = {
          count: 0,
          stockValue: 0
        };
      }
      summary.categoryBreakdown[product.category].count += 1;
      summary.categoryBreakdown[product.category].stockValue += stockValue;
    }

    return summary;
  }

  // Get recent stock movements (all products)
  async getRecentMovements(limit = 50) {
    const movements = await StockMovement.find()
      .populate('product', 'name category')
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    return movements;
  }
}

module.exports = new InventoryService();