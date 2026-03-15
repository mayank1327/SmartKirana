const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },

  baseUnit: {
    _id: {
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

  units: [{
    _id: {
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

  variations: [{
    _id: {
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
      // always derived from unit name — validated in service layer
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
      default: null, // optional at creation — derived from first purchase if not set manually
      min: [0, 'MSP cannot be negative']
    }
  }],

  costPricePerBaseUnit: {
    type: Number,
    default: null, // optional at creation — derived from first purchase if not set manually
    min: [0, 'Cost price cannot be negative']
  },

  currentStock: {
    type: Number,
    required: true,
    default: 0,
    // min: [0, 'Stock cannot be negative']
    // allow negative stock for backorders, but validate in business logic
  },

  minStockLevel: {
    type: Number,
    default: null, // optional at creation — can be set later for low stock alerts 
    min: [0, 'Minimum stock level cannot be negative']
  },

  isActive: {
    type: Boolean,
    default: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }

}, { timestamps: true });

productSchema.index({ userId: 1, isActive: 1 });
productSchema.index({ userId: 1, currentStock: 1 });
productSchema.index({ userId: 1, productName: 1 },{ unique: true });

module.exports = mongoose.model('Product', productSchema);