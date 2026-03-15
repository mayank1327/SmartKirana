const Bill = require('../models/Bill');

class BillRepository {
  
  async create(billData, session = null) {
    if (session) {
      return Bill.create([billData], { session }).then(docs => docs[0]);
    }
    return Bill.create(billData);
  }
  
  async findAll(filter = {}, options = {}, session = null) {
    const { 
      skip = 0, 
      limit = 20, 
      sort = { billDate: -1 }, 
      select = null, 
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

  async findOne(filter = {}, session = null) {
    return session
      ? Bill.findOne(filter).session(session)
      : Bill.findOne(filter);
  }

  async save(bill, session = null) {
    return session ? bill.save({ session }) : bill.save();
  }
  
  async countDocuments(filter = {}, session = null) {
    return session
      ? Bill.countDocuments(filter).session(session)
      : Bill.countDocuments(filter);
  }
  
}

module.exports = new BillRepository();