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
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  }
});

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Supplier name is required'],
    trim: true,
    maxlength: [100, 'Supplier name cannot exceed 100 characters']
  },
  contactPerson: {
    type: String,
    trim: true,
    maxlength: [100, 'Contact person name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[6-9]\d{9}$/, 'Please enter valid phone number']
  },
  address: {
    type: String,
    trim: true,
    maxlength: [300, 'Address cannot exceed 300 characters']
  }
});

const purchaseSchema = new mongoose.Schema({
  purchaseNumber: {
    type: String,
    unique: true,
    // required: [true, 'Purchase number is required']
  },
  supplier: supplierSchema,
  items: [purchaseItemSchema],
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
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending'
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  paymentDueDate: {
    type: Date
  },
  deliveryStatus: {
    type: String,
    enum: ['pending', 'partial', 'delivered'],
    default: 'delivered'
  },
  invoiceNumber: {
    type: String,
    trim: true,
    maxlength: [100, 'Invoice number cannot exceed 100 characters']
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
  purchaseDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
purchaseSchema.index({ purchaseDate: -1 });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ 'supplier.name': 1 });
purchaseSchema.index({ purchaseNumber: 1 });

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

// Virtual for remaining payment amount
purchaseSchema.virtual('remainingAmount').get(function() {
  return this.totalAmount - this.paidAmount;
});

// Virtual for payment completion percentage
purchaseSchema.virtual('paymentPercentage').get(function() {
  return this.totalAmount > 0 ? (this.paidAmount / this.totalAmount) * 100 : 0;
});

module.exports = mongoose.model('Purchase', purchaseSchema);