const mongoose = require('mongoose');

// Bill item sub-schema
const billItemSchema = new mongoose.Schema({
  // For existing products (normal flow)
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null  // Null for temporary products
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  
  // Variation details (only for existing products)
  variationId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null  // Null for temporary products
  },
  variationName: {
    type: String,
    default: null  // Null for temporary products
  },
  
  // For temporary products (Quick Add)
  tempProductName: {
    type: String,
    default: null,  // Only filled for temporary products
    trim: true
  },
  
  // Common fields for all items
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.01, 'Quantity must be greater than 0']
  },
  
  pricePerUnit: {
    type: Number,
    required: [true, 'Price per unit is required'],
    min: [0, 'Price cannot be negative']
  },
  
  // Effective price after line total adjustment
  effectivePricePerUnit: {
    type: Number,
    required: [true, 'Effective price is required'],
    min: [0, 'Effective price cannot be negative']
  },
  
  lineTotal: {
    type: Number,
    required: [true, 'Line total is required'],
    min: [0, 'Line total cannot be negative']
  }
}, { _id: true });

// Main Bill Schema
const billSchema = new mongoose.Schema({
  // Bill identification
  billNumber: {
    type: String,
     unique: true,
    // required: [true, 'Bill number is required']
  },
  
  // User (shop owner)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },
  
  // Bill details
  billDate: {
    type: Date,
    default: Date.now,
  },
  
  customerName: {
    type: String,
    trim: true,
    maxlength: [100, 'Customer name cannot exceed 100 characters'],
    default: null  // Optional
  },
  
  // Items array (existing + temporary products)
  items: [billItemSchema],
  
  // Pricing
  subTotal: {
    type: Number,
    required: [true, 'Sub total is required'],
    min: [0, 'Sub total cannot be negative']
  },
  
  discount: {
    type: Number,
    default: 0,  // Can be negative (discount) or positive (adjustment)
    required: [true, 'Discount is required']
  },
  
  finalTotal: {
    type: Number,
    required: [true, 'Final total is required'],
    min: [0.01, 'Final total must be greater than 0']
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

// Auto-generate bill number (BILL-YYYYMMDD-XXX)
billSchema.pre('save', async function(next) {
  if (this.isNew && !this.billNumber) {
    try {
      const today = new Date();
      const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Find last bill of the day for this user
      const lastBill = await this.constructor.findOne({
        userId: this.userId,
        billNumber: new RegExp(`^BILL-${dateString}-`)
      }).sort({ billNumber: -1 });
      
      let sequence = 1;
      if (lastBill) {
        const lastSequence = parseInt(lastBill.billNumber.split('-').pop());
        sequence = lastSequence + 1;
      }
      
      this.billNumber = `BILL-${dateString}-${sequence.toString().padStart(3, '0')}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

// Validation: At least one item required
billSchema.pre('validate', function(next) {
  if (!this.items || this.items.length === 0) {
    return next(new Error('At least one item is required in the bill'));
  }
  next();
});

module.exports = mongoose.model('Bill', billSchema);