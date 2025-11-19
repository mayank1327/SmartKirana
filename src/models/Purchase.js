const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
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
  unitCost: {
    type: Number,
    required: [true, 'Unit cost is required'],
    min: [0, 'Unit cost cannot be negative']
  },
  minSellingPrice: {
    type: Number,
    required: true,
    min: [0, 'Minimum selling price cannot be negative']
  },
  lineTotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  }
});

const purchaseSchema = new mongoose.Schema({
  purchaseNumber: {
    type: String,
    unique: true,
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  supplierName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  items: [purchaseItemSchema],
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  paymentMode: {
    type: String,
    enum: ['cash', 'credit', 'UPI', 'cheque'],
    default: 'cash'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  purchasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
}, {
  timestamps: true
});

// Indexes for better query performance
purchaseSchema.index({ purchaseDate: -1 });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ supplierName : 1 });

// Auto-generate purchase number
purchaseSchema.pre('save', async function(next) {
  if (this.isNew) {
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Find the last purchase of the day
    const lastPurchase = await this.constructor.findOne({
      purchaseNumber: new RegExp(`^PUR-${dateString}-`)
    }).sort({ purchaseNumber: -1 });
    
    let sequence = 1;
    if (lastPurchase) {
      const lastSequence = parseInt(lastPurchase.purchaseNumber.split('-').pop());
      sequence = lastSequence + 1;
    }
    
    this.purchaseNumber = `PUR-${dateString}-${sequence.toString().padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Purchase', purchaseSchema);

