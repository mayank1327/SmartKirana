const Product = require('../models/Product');

class ProductRepository {

// Find multiple products with filters, pagination, sorting // TODO :> aggregation in future
async findAll(filters = {}, options = {}) {        
  const { page = 1, limit = 10, sort = { createdAt: -1 }, projection = {} } = options;

  const skip = (page - 1) * limit;

  const products = await Product.find(filters, projection)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await Product.countDocuments(filters); // Extra DB Query
  return { products, total };
}

 // Search products by name (text search or regex)
 async search(searchText, extraFilters = {}, options = {}) {
  const filters = {
    name: { $regex: searchText, $options: 'i' }, // Case-insensitive partial match
    isActive: true,
    ...extraFilters
  };
  
  return this.findAll(filters, options);
}

// Fetch product by ID
async findById(id, session = null) {
    return session 
      ? Product.findById(id).session(session) 
      : Product.findById(id);
}

async updateById(productId, update, session = null) { // update Product by ID
  return Product.findByIdAndUpdate(productId, update, { new: true, session }); // return updated document
}

// Fetch product by name or other unique fields
async findOne(filter, session = null) {
    return session 
      ? Product.findOne(filter).session(session) 
      : Product.findOne(filter);
}


async findMany(filter, session = null) {
  return session 
    ? Product.find(filter).session(session) 
    : Product.find(filter);
}

// Create new product
async create(productData, session = null) {
    return session 
      ? Product.create([productData], { session }) 
      : Product.create(productData);
}

// Soft delete product
async softDelete(id) {
    return Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
}

async save(product, session = null) {// That's right ->Instance method to save changes to a product // Instance vs Static methods
    return product.save({ session });
  }

// Find low stock products
async findLowStock(extraFilters = {}) {
    return Product.find({ isLowStock: true, ...extraFilters }).sort({ currentStock: 1 });
}

// Count documents matching a filter
async countDocuments(filter) {
    return Product.countDocuments(filter);
}

async aggregate(pipeline) {
    return Product.aggregate(pipeline);
}
}

module.exports = new ProductRepository();