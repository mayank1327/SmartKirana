const Sale = require('../models/Sale');

class SalesRepository {
   
    async createSale(data, session = null) {
      return Sale.create([data], { session }).then(docs => docs[0]);
    }
  
    async findSaleById(id, populate = [], session = null) {
      let query = Sale.findById(id).session(session);
      
      // Handle both array and single object
      if (populate) {
        const populateArray = Array.isArray(populate) ? populate : [populate];
        populateArray.forEach(p => query = query.populate(p));
      }
      
      return query.exec();
    }
    async findSales(filter = {}, options = {}, session = null) {
      const { skip = 0, limit = 20, sort = { saleDate: -1 }, select = '', populate = [] } = options;
      let query = Sale.find(filter).sort(sort).skip(skip).limit(limit).select(select).session(session);
      populate.forEach(p => query = query.populate(p));
      return query.exec();
    }
  
    async countDocuments(filter, session = null) {
      return Sale.countDocuments(filter).session(session);
    }
  
    async aggregate(pipeline = [], session = null) {
      if (session) return Sale.aggregate(pipeline).session(session);
      return Sale.aggregate(pipeline);
    }
  
    async save(sale, session = null) {
      return session ? sale.save({ session }) : sale.save();
    }
  }
  
  module.exports = new SalesRepository();


