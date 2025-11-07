const Product = require('../../src/models/Product');
const Sale = require('../../src/models/Sale');

// Create test product
async function createTestProduct(overrides = {}) {
  return Product.create({
    name: 'Test Milk',
    unit: 'liter',
    costPrice: 40,
    minSellingPrice: 60,
    currentStock: 100,
    minStockLevel: 10,
    isActive: true,
    ...overrides
  });
}

// Create test sale
async function createTestSale(userId, productId, overrides = {}) {
  return Sale.create({
    items: [{
      product: productId,
      productName: 'Test Milk',
      quantity: 2,
      unitPrice: 60,
      subtotal: 120
    }],
    subtotal: 120,
    totalAmount: 120,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    soldBy: userId,
    ...overrides
  });
}

module.exports = { createTestProduct, createTestSale };