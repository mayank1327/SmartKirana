const Bill = require('../models/Bill');

class BillRepository {
  
  // Create new bill
  async create(billData, session = null) {
    if (session) {
      return Bill.create([billData], { session }).then(docs => docs[0]);
    }
    return Bill.create(billData);
  }
  
  // Find bill by ID
  async findById(id, populate = [], session = null) {
    let query = Bill.findById(id);
    
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
  
  // Find bills with filters
  async findBills(filter = {}, options = {}, session = null) {
    const { 
      skip = 0, 
      limit = 20, 
      sort = { billDate: -1 }, 
      select = '', 
      populate = [] 
    } = options;
    
    let query = Bill.find(filter)
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
      ? Bill.countDocuments(filter).session(session)
      : Bill.countDocuments(filter);
  }
  
  // Aggregate
  async aggregate(pipeline = [], session = null) {
    if (session) {
      return Bill.aggregate(pipeline).session(session);
    }
    return Bill.aggregate(pipeline);
  }
  
  // Save bill instance
  async save(bill, session = null) {
    return session ? bill.save({ session }) : bill.save();
  }
  
  // Find one bill
  async findOne(filter = {}, session = null) {
    return session
      ? Bill.findOne(filter).session(session)
      : Bill.findOne(filter);
  }
}

module.exports = new BillRepository();