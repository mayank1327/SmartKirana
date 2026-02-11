const mongoose = require('mongoose');

// Purchase item sub-schema
const purchaseItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product reference is required']
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  
  // Variation details
  variationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Variation reference is required']
  },
  variationName: {
    type: String,
    required: [true, 'Variation name is required'],
    trim: true
  },
  
  // Purchase details
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.01, 'Quantity must be greater than 0']
  },
  
  costPricePerUnit: {
    type: Number,
    required: [true, 'Cost price per unit is required'],
    min: [0, 'Cost price cannot be negative']
  },
  
  lineTotal: {
    type: Number,
    required: [true, 'Line total is required'],
    min: [0, 'Line total cannot be negative']
  },
  
  // Stock tracking (for reference/history)
  stockBefore: {
    type: Number,
    required: [true, 'Stock before is required']
  },
  
  stockAfter: {
    type: Number,
    required: [true, 'Stock after is required']
  }
}, { _id: true });

// Main Purchase Schema
const purchaseSchema = new mongoose.Schema({
  // Purchase identification
  purchaseNumber: {
    type: String,
    unique: true,
    // required: [true, 'Purchase number is required']
  },
  
  // User (shop owner)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },
  
  // Purchase details
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  
  supplierName: {
    type: String,
    trim: true,
    maxlength: [100, 'Supplier name cannot exceed 100 characters'],
    default: null  // Optional
  },
  
  supplierBillNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Supplier bill number cannot exceed 50 characters'],
    default: null  // Optional
  },
  
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    default: null  // Optional
  },
  
  // Items array
  items: [purchaseItemSchema],
  
  // Total amount
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});


// Auto-generate purchase number (PUR-YYYYMMDD-XXX)
purchaseSchema.pre('save', async function(next) {
  if (this.isNew && !this.purchaseNumber) {
    try {
      const today = new Date();
      const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Find last purchase of the day for this user
      const lastPurchase = await this.constructor.findOne({
        userId: this.userId,
        purchaseNumber: new RegExp(`^PUR-${dateString}-`)
      }).sort({ purchaseNumber: -1 });
      
      let sequence = 1;
      if (lastPurchase) {
        const lastSequence = parseInt(lastPurchase.purchaseNumber.split('-').pop());
        sequence = lastSequence + 1;
      }
      
      this.purchaseNumber = `PUR-${dateString}-${sequence.toString().padStart(3, '0')}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

// Validation: At least one item required
purchaseSchema.pre('validate', function(next) {
  if (!this.items || this.items.length === 0) {
    return next(new Error('At least one item is required in the purchase'));
  }
  next();
});

module.exports = mongoose.model('Purchase', purchaseSchema);