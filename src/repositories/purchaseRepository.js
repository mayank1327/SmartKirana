const Product = require('../models/Product');
const Purchase = require('../models/Purchase');

class PurchaseRepository {

    async findProductById(id ,  session = null) {  // find Product by ID
        return Product.findById(id).session(session);
    }

    async createPurchase(data, session = null) {   // create New Purchase
       // If session exists, pass it to create
       return Purchase.create([data], { session }).then(docs => docs[0]);
    }

    async updateProductById(productId, update, session = null) { // update Product by ID
        return Product.findByIdAndUpdate(productId, update, { new: true, session }); // return updated document
    }

    async findPurchaseById(id, populate = [], session = null) { // find Purchase by ID with optional populates
        let query = Purchase.findById(id).session(session);
        populate.forEach(p => query = query.populate(p.path, p.select));
        return query;
      }

    async findPurchases(filter = {}, options = {}, session = null) { // find Purchases with filtering, pagination, sorting, and populates
        const { skip = 0, limit = 20, sort = { purchaseDate: -1 }, select = '', populate = [] } = options;
        let query = Purchase.find(filter).sort(sort).skip(skip).limit(limit).select(select).session(session);
    
        // Apply populates
        populate.forEach(p => query = query.populate(p.path, p.select));
    
        return query;
      }

      async countDocuments(filter, session = null) { // count Documents matching filter
        return Purchase.countDocuments(filter).session(session);
      }

      async save(purchase, session = null) { // save Purchase instance
        if (session) {
            return purchase.save({ session });
        }
        return purchase.save();
      }

      async aggregate(pipeline = [], session = null) { // aggregate with custom pipeline
        if (session) {
            return Purchase.aggregate(pipeline).session(session);
        }
        return Purchase.aggregate(pipeline);
      }

}

module.exports = new PurchaseRepository();