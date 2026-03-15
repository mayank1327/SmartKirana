const Product = require('../models/Product');

class ProductRepository {

async findAll(filters = {}, options = {}) {

  const { page = 1, limit = 10, sort = { createdAt: -1 }} = options;

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    Product.find(filters).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filters)
  ]);

  return { 
    products, 
    total 
  };

}

async findOne(filter, session = null) {
  return session 
    ? Product.findOne(filter).session(session) 
    : Product.findOne(filter);
}

async create(productData, session = null) {
  if (session) {
    return Product.create([productData], { session }).then(res => res[0]);
  }
  return Product.create(productData);
}

/* if product is already a Mongoose document, just call save on it. 
Otherwise, create a new document and save it. */
async save(product, session = null) {
  return product.save({ session });
}

// Used in billing/purchase transactions — fetching multiple products at once
async findMany(filter = {}, session = null) {
  return session 
    ? Product.find(filter).session(session) 
    : Product.find(filter);
}

}

// Singleton — one instance shared across the app
module.exports = new ProductRepository();