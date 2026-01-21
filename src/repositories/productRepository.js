const Product = require('../models/Product');

class ProductRepository {

// Find multiple products with filters, pagination, sorting // TODO :> aggregation in future
async findAll(filters = {}, options = {}) {        
  const { page = 1, limit = 10, sort = { createdAt: -1 }, projection = {} } = options;

  const skip = (page - 1) * limit;

  const products = await Product.find(filters, projection)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    
    const total = await Product.countDocuments(filters);                          
  return { 
    products, 
    total 
  };
}

// Fetch product by name or other unique fields
async findOne(filter, session = null) {
  return session 
    ? Product.findOne(filter).session(session) 
    : Product.findOne(filter);
}

 // Find many products without pagination (for bulk operations) (related with sales);
 async findMany(filter = {}, session = null) {
  return session 
    ? Product.find(filter).session(session) 
    : Product.find(filter);
}

 // Find product by ID (inventory Service);
 async findById(id, session = null) {
  return session
    ? Product.findById(id).session(session)
    : Product.findById(id);
}

// Create new product
async create(productData, session = null) {
  if (session) {
    return Product.create([productData], { session }).then(res => res[0]);
  }
  return Product.create(productData);
}

async save(product, session = null) {// That's right ->Instance method to save changes to a product // Instance vs Static methods
  return product.save({ session });
}

async updateById(productId, update, session = null) { // update Product by ID
  return Product.findByIdAndUpdate(productId, update, { new: true, session }); // return updated document
}
// Soft delete product
async softDelete(id, session = null) {
  return Product.findByIdAndUpdate(id, { isActive: false }, { new: true,  session});
}


}

module.exports = new ProductRepository();