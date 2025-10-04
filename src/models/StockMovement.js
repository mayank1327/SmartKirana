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
  const expectedNew = this.movementType === 'IN' 
    ? this.previousStock + this.quantity
    : this.previousStock - this.quantity;
  
  if (this.newStock !== expectedNew) {
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

// Refinement task: Analyze actual queries, remove redundant indexes.
// // // These two indexes overlap:
// { product: 1, createdAt: -1 }           // Index 1
// { product: 1, movementType: 1, createdAt: -1 } // Index 2 (superset)

// // Index 2 can handle Index 1's queries!
// // Consider removing Index 1 (save memory)

// Should movements be IMMUTABLE?
//  Consideration: Prevent updates after creation
// stockMovementSchema.pre('findOneAndUpdate', function(next) {
//   next(new Error('Stock movements cannot be modified after creation'));
// });

// // Only allow creation (POST) and reading (GET), no PUT/PATCH/DELETE
// Audit trails should be append-only! Note for refinement.


// Missing Fields (Consider Adding):
// javascript// 1. Stock value (for accounting)
// value: {
//   costPrice: Number,  // Product cost at time of movement
//   totalValue: Number  // quantity * costPrice
// }

// // 2. Location (for multi-warehouse)
// location: {
//   type: String,
//   default: 'main'
// }

// // 3. Batch/Lot tracking (for expiry management)
// batch: {
//   type: String,
//   expiryDate: Date
// }
// Don't add yet - only when needed (YAGNI).

