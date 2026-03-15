const Purchase = require('../models/Purchase');

class PurchaseRepository {
  
  
  async create(purchaseData, session = null) {
    if (session) {
      return Purchase.create([purchaseData], { session }).then(docs => docs[0]);
    }
    return Purchase.create(purchaseData);
  }
  
  async findById(id, populate = [], session = null) {
    let query = Purchase.findById(id);
    
    if (session) {
      query = query.session(session);
    }
    
    // Apply populates
    if (populate && populate.length > 0) {
      populate.forEach(p => {
        query = query.populate(p.path, p.select);
      });
    }
    
    return query.exec();
  }
  
  async findAll(filter = {}, options = {}, session = null) {
    const { 
      skip = 0, 
      limit = 20, 
      sort = { purchaseDate: -1 }, 
      select = null, 
      populate = [] 
    } = options;
    
    let query = Purchase.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(select);
    
    if (session) {
      query = query.session(session);
    }
    
    // Apply populates
    populate.forEach(p => {
      query = query.populate(p.path, p.select);
    });
    
    return query.exec();
  }

  async findOne(filter = {}, session = null) {
    return session
      ? Purchase.findOne(filter).session(session)
      : Purchase.findOne(filter);
  }
  
  async countDocuments(filter = {}, session = null) {
    return session
      ? Purchase.countDocuments(filter).session(session)
      : Purchase.countDocuments(filter);
  }
  
  async aggregate(pipeline = []) {
    return Purchase.aggregate(pipeline);
  }
  
  async save(purchase, session = null) {
    return session ? purchase.save({ session }) : purchase.save();
  }
  
}

module.exports = new PurchaseRepository();