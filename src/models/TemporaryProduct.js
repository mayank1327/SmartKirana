const mongoose = require('mongoose');

const temporaryProductSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
  },
  
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },

  billIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  }],
 
  totalRevenue: {
    type: Number,
    default: 0,
    min: [0, 'Total revenue cannot be negative']
  },
  
  lastSoldDate: {
    type: Date,
    required: [true, 'Last sold date is required']
  },

  isPendingSetup: {
    type: Boolean,
    default: true
  },
  
  convertedProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  
  setupCompletedAt: {
    type: Date,
    default: null
  }

}, { timestamps: true });


temporaryProductSchema.index({ userId: 1, isPendingSetup: 1 });
// Pending setup wale products fetch karne ke liye — common query

temporaryProductSchema.index( { userId: 1, productName: 1 },{ unique: true } );

module.exports = mongoose.model('TemporaryProduct', temporaryProductSchema);