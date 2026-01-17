const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // 1. Product Name
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },

  // 2. Base Unit (smallest selling unit)
  baseUnit: {
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    unitName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    }
  },

  // 3. All Units
  units: [{
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    unitName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    isBaseUnit: {
      type: Boolean,
      default: false
    }
  }],

  // 4. Variations (one per unit)
  variations: [{
    variationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    variationName: {
      type: String,
      required: true,
      trim: true
    },
    containsQuantity: {
      type: Number,
      required: true,
      min: [1, 'Contains quantity must be at least 1']
    },
    containsUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    conversionToBase: {
      type: Number,
      required: true,
      min: [1, 'Conversion to base must be at least 1']
    },
    minSellingPrice: {
      type: Number,
      default: null,  // Optional during creation, required during first purchase
      min: [0, 'MSP cannot be negative']
    }
  }],

  // 5. Cost Price (ONLY base unit, from first purchase)
  costPricePerBaseUnit: {
    type: Number,
    default: null,  // Set during first purchase
    min: [0, 'Cost price cannot be negative']
  },

  // 6. Current Stock (ALWAYS in base unit)
  currentStock: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Stock cannot be negative']  // For MVP: no negative stock
  },

  // 7. Minimum Stock Level (in base unit, optional at creation, required at first purchase)
  minStockLevel: {
    type: Number,
    default: null,  // Can be null initially
    min: [0, 'Minimum stock level cannot be negative']
  },

  // 8. Active Status
  isActive: {
    type: Boolean,
    default: true
  },

  // 9. User Ownership
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);
