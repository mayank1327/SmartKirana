const Purchase = require('../models/Purchase');

class PurchaseRepository {
  
  // Create new purchase
  async create(purchaseData, session = null) {
    if (session) {
      return Purchase.create([purchaseData], { session }).then(docs => docs[0]);
    }
    return Purchase.create(purchaseData);
  }
  
  // Find purchase by ID
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
  
  // Find purchases with filters
  async findPurchases(filter = {}, options = {}, session = null) {
    const { 
      skip = 0, 
      limit = 20, 
      sort = { purchaseDate: -1 }, 
      select = '', 
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
  
  // Count documents
  async countDocuments(filter = {}, session = null) {
    return session
      ? Purchase.countDocuments(filter).session(session)
      : Purchase.countDocuments(filter);
  }
  
  // Aggregate
  async aggregate(pipeline = [], session = null) {
    if (session) {
      return Purchase.aggregate(pipeline).session(session);
    }
    return Purchase.aggregate(pipeline);
  }
  
  // Save purchase instance
  async save(purchase, session = null) {
    return session ? purchase.save({ session }) : purchase.save();
  }
  
  // Find one purchase
  async findOne(filter = {}, session = null) {
    return session
      ? Purchase.findOne(filter).session(session)
      : Purchase.findOne(filter);
  }
}

module.exports = new PurchaseRepository();