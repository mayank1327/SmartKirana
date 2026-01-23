const TemporaryProduct = require('../models/TemporaryProduct');

class TemporaryProductRepository {
  
  // Create new temporary product
  async create(data, session = null) {
    if (session) {
      return TemporaryProduct.create([data], { session }).then(docs => docs[0]);
    }
    return TemporaryProduct.create(data);
  }
  
  // Find one temporary product
  async findOne(filter = {}, session = null) {
    return session
      ? TemporaryProduct.findOne(filter).session(session)
      : TemporaryProduct.findOne(filter);
  }
  
  // Find by ID
  async findById(id, session = null) {
    return session
      ? TemporaryProduct.findById(id).session(session)
      : TemporaryProduct.findById(id);
  }
  
  // Find all with filters
  async find(filter = {}, options = {}, session = null) {
    const { sort = { lastSoldDate: -1 }, limit, skip } = options;
    
    let query = TemporaryProduct.find(filter).sort(sort);
    
    if (limit) query = query.limit(limit);
    if (skip) query = query.skip(skip);
    if (session) query = query.session(session);
    
    return query.exec();
  }
  
  // Update by ID
  async updateById(id, update, session = null) {
    return TemporaryProduct.findByIdAndUpdate(id, update, {
      new: true,
      session,
      runValidators: true
    });
  }
  
  // Save instance
  async save(tempProduct, session = null) {
    return session ? tempProduct.save({ session }) : tempProduct.save();
  }
  
  // Delete by ID
  async deleteById(id, session = null) {
    return session
      ? TemporaryProduct.findByIdAndDelete(id).session(session)
      : TemporaryProduct.findByIdAndDelete(id);
  }
  
  // Count documents
  async countDocuments(filter = {}, session = null) {
    return session
      ? TemporaryProduct.countDocuments(filter).session(session)
      : TemporaryProduct.countDocuments(filter);
  }
  
  // Aggregate
  async aggregate(pipeline = [], session = null) {
    if (session) {
      return TemporaryProduct.aggregate(pipeline).session(session);
    }
    return TemporaryProduct.aggregate(pipeline);
  }
}

module.exports = new TemporaryProductRepository();