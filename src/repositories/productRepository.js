const Product = require('../models/Product');

class ProductRepository {

// Find multiple products with filters, pagination, sorting // TODO :> aggregation in future
async findAll(filters = {}, { page = 1, limit = 10, sort = { createdAt: -1 } } = {}) { 

  const skip = (page - 1) * limit;

  const products = await Product.find(filters)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await Product.countDocuments(filters); // Extra DB Query
  return { products, total };
}

// Fetch product by ID
async findById(filter) {
    return Product.findById(filter);
}

// Fetch product by name or other unique fields
async findOne(filter) {
    return Product.findOne(filter);
}

// Create new product
async create(productData) {
    return Product.create(productData);
}

// Soft delete product
async softDelete(id) {
    return Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
}

async save(product) {  // That's right ->Instance method to save changes to a product // Instance vs Static methods
    return product.save();
}

// Find low stock products
async findLowStock(extraFilters = {}) {
    return Product.find({ isLowStock: true, ...extraFilters }).sort({ currentStock: 1 });
}

// Count documents matching a filter
async countDocuments(filter) {
    return Product.countDocuments(filter);
}
}

module.exports = new ProductRepository();