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
  unit: { 
    type: String, 
    required: true 
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
  lineTotal: {
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
  saleDate: {
    type: Date,
    default: Date.now
  },
  items: [saleItemSchema],
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['cash', 'upi', 'credit'],
    default: 'cash',
    lowercase: true
  }, 
  customerName: {
      type: String,
      trim: true,
      maxlength: [100, 'Customer name cannot exceed 100 characters']
  },
  soldBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled'],
    default: 'completed'
  },
}, {
  timestamps: true
});

// Indexes for better query performance
saleSchema.index({ saleDate: -1 });
saleSchema.index({ paymentMethod: 1 });

// Auto-generate sale number
saleSchema.pre('save', async function(next) {  // TODO : ATOMIC COUNTER 
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

module.exports = mongoose.model('Sale', saleSchema);
