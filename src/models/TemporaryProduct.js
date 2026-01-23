const mongoose = require('mongoose');

const temporaryProductSchema = new mongoose.Schema({
  // User (shop owner)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },
  
  // Product name (unique per user, case-insensitive)
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  
  // First bill where it appeared
  firstBillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: [true, 'First bill reference is required']
  },
  
  // All bills containing this temporary product
  billIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  }],
  
  // Aggregated statistics
  totalQuantitySold: {
    type: Number,
    default: 0,
    min: [0, 'Total quantity sold cannot be negative']
  },
  
  totalRevenue: {
    type: Number,
    default: 0,
    min: [0, 'Total revenue cannot be negative']
  },
  
  lastSoldDate: {
    type: Date,
    required: [true, 'Last sold date is required']
  },
  
  // Setup status
  isPendingSetup: {
    type: Boolean,
    default: true
  },
  
  // After complete setup
  convertedProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  
  setupCompletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// // Compound unique index: productName per user (case-insensitive)
// temporaryProductSchema.index(
//   { userId: 1, productName: 1 },
//   { 
//     unique: true,
//     collation: { locale: 'en', strength: 2 }  // Case-insensitive
//   }
// );

// Index for querying pending setup items
// temporaryProductSchema.index({ userId: 1, isPendingSetup: 1, lastSoldDate: -1 });

module.exports = mongoose.model('TemporaryProduct', temporaryProductSchema);