const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product reference is required']
  },
  productName: {
    type: String,
    required: [true, 'Product name is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  }
});

const saleSchema = new mongoose.Schema({
  saleNumber: {
    type: String,
    unique: true,
    // required: [true, 'Sale number is required']
  },
  items: [saleItemSchema],
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['cash', 'card', 'upi', 'credit'],
    lowercase: true
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'partial'],
    default: 'paid'
  },
  customerInfo: {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Customer name cannot exceed 100 characters']
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please enter valid phone number']
    }
  },
  creditAmount: {
    type: Number,
    default: 0,
    min: [0, 'Credit amount cannot be negative']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  soldBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  saleDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
saleSchema.index({ saleDate: -1 });
saleSchema.index({ paymentMethod: 1 });
saleSchema.index({ soldBy: 1 });
saleSchema.index({ saleNumber: 1 });

// Auto-generate sale number
saleSchema.pre('save', async function(next) {
    if (this.isNew) {
      try {
        const today = new Date();
        const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
  
        // Find last sale of the day
        const lastSale = await this.constructor.findOne({
          saleNumber: new RegExp(`^SALE-${dateString}-`)
        }).sort({ saleNumber: -1 });
  
        let sequence = 1;
        if (lastSale) {
          const lastSeq = parseInt(lastSale.saleNumber.split('-').pop());
          sequence = lastSeq + 1;
        }
  
        this.saleNumber = `SALE-${dateString}-${sequence.toString().padStart(3, '0')}`;
       
        next();
      } catch (err) {
        console.error('Error generating saleNumber:', err);
        next(err); // Pass error to Mongoose error handler
      }
    } else {
      next();
    }
  });

// Virtual for profit calculation
saleSchema.virtual('totalProfit').get(function() {
  // This would require product cost prices to calculate accurately
  // For now, return 0 - implement after integrating with product data
  return 0;
});

module.exports = mongoose.model('Sale', saleSchema);