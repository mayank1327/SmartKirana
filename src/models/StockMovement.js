const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product reference is required']
  },
  movementType: {
    type: String,
    required: [true, 'Movement type is required'],
    enum: ['IN', 'OUT', 'ADJUSTMENT'],
    uppercase: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be positive'] // Quantity should always be positive; direction is indicated by movementType
  },
  previousStock: {
    type: Number,
    required: [true, 'Previous stock is required'],
    min: [0, 'Previous stock cannot be negative']
  },
  newStock: {
    type: Number,
    required: [true, 'New stock is required'],
    min: [0, 'New stock cannot be negative']
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    enum: ['purchase', 'sale', 'damage', 'expired', 'theft', 'correction', 'return'],
    lowercase: true
  },
  reference: {
    model: { type: String, enum: ['Sale', 'Purchase', 'Adjustment'] },
    id: { type: mongoose.Schema.Types.ObjectId, refPath: 'reference.model' }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  }
}, {
  timestamps: true
});

// Indexes for better query performance
// Add this for common queries
stockMovementSchema.index({ product: 1, movementType: 1, createdAt: -1 });
stockMovementSchema.index({ movementType: 1 });  // Less common than product-based queries - consider removing if not used.
stockMovementSchema.index({ reason: 1 });
stockMovementSchema.index({ performedBy: 1 });

stockMovementSchema.pre('save', function(next) {
  let expectedNew;

  if (this.movementType === 'ADJUSTMENT') {
    expectedNew = this.newStock; // skip validation or ensure quantity matches diff
  } else if (this.movementType === 'IN') {
    expectedNew = this.previousStock + this.quantity;
  } else {
    // OUT / SALE / etc.
    expectedNew = this.previousStock - this.quantity;
  }

  if (this.movementType !== 'ADJUSTMENT' && this.newStock !== expectedNew) {
    return next(new Error('Stock calculation mismatch'));
  }

  next();
});

// Consideration: Prevent updates after creation
stockMovementSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Stock movements cannot be modified after creation'));
});

// Virtual for movement direction
stockMovementSchema.virtual('movementDirection').get(function() {
  return this.movementType === 'IN' ? '+' : '-';
});

module.exports = mongoose.model('StockMovement', stockMovementSchema);

