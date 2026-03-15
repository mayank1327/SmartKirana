const TemporaryProduct = require('../models/TemporaryProduct');

class TemporaryProductRepository {
  
  async create(data, session = null) {
    if (session) {
      return TemporaryProduct.create([data], { session }).then(docs => docs[0]);
    }
    return TemporaryProduct.create(data);
  }
  
  async findOne(filter = {}, session = null) {
    return session
      ? TemporaryProduct.findOne(filter).session(session)
      : TemporaryProduct.findOne(filter);
  }
  
  async findById(id, session = null) {
    return session
      ? TemporaryProduct.findById(id).session(session)
      : TemporaryProduct.findById(id);
  }
  
  async findAll(filter = {}, options = {}, session = null) {
    const { sort = { lastSoldDate: -1 }, limit, skip } = options;
    
    let query = TemporaryProduct.find(filter).sort(sort);
    
    if (limit) query = query.limit(limit);
    if (skip) query = query.skip(skip);
    if (session) query = query.session(session);
    
    return query.exec();
  }

  async save(tempProduct, session = null) {
    return session ? tempProduct.save({ session }) : tempProduct.save();
  }
  
  async deleteById(id, session = null) {
    return session
      ? TemporaryProduct.findByIdAndDelete(id).session(session)
      : TemporaryProduct.findByIdAndDelete(id);
  }
  
}

module.exports = new TemporaryProductRepository();