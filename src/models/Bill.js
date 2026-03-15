const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({

  isTemporary: {
    type: Boolean,
    default: false
  },

  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },

  variationId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  variationName: {
    type: String,
    default: null
  },

  /* Unified name field 
   * Regular product ke liye: Product ka naam (denormalized copy)
   * Temp product ke liye: user-entered naam */

  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },

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

const billSchema = new mongoose.Schema({
 
  billNumber: {
    type: String,
    unique: true,
    sparse: true  // null values ko unique constraint se exempt karo
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },
  
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
  
  items: [billItemSchema],
  
  subTotal: {
    type: Number,
    required: [true, 'Sub total is required'],
    min: [0, 'Sub total cannot be negative']
  },
  
  discount: {
    type: Number,
    default: 0,  
    max: [0, 'Discount cannot be positive']
  },
  
  finalTotal: {
    type: Number,
    required: [true, 'Final total is required'],
    min: [0.01, 'Final total must be greater than 0']
  }

}, {timestamps: true });

billSchema.index({ userId: 1, billDate: -1 });
billSchema.index({ userId: 1, billNumber: 1 });

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

billSchema.pre('validate', function(next) {
  if (!this.items || this.items.length === 0) {
    return next(new Error('At least one item is required in the bill'));
  }
  next();
});

module.exports = mongoose.model('Bill', billSchema);