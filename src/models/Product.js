const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    enum: ['grocery', 'dairy', 'snacks', 'beverages', 'household', 'personal-care', 'other'],
    default: 'other'
  },
  costPrice: {
    type: Number,
    required: [true, 'Cost price is required'],
    min: [0, 'Cost price must be positive']
  },
  
  sellingPrice: {
    type: Number,
    required: [true, 'Selling price is required'],
    min: [0, 'Selling price must be positive'],
    validate: { // Nested validation to ensure sellingPrice >= costPrice
      validator: function() {
        return this.sellingPrice >= this.costPrice;
      },
      message: 'Selling price must be greater than or equal to cost price'
    }
    
  },
  currentStock: {
    type: Number,
    required: [true, 'Current stock is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  minStockLevel: {
    type: Number,
    required: [true, 'Minimum stock level is required'],
    min: [0, 'Minimum stock level must be positive'],
    default: 10
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    enum: ['piece', 'kg', 'liter', 'packet', 'box'],
    default: 'piece'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better search performance
productSchema.index({ name: 'text', category: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ currentStock: 1 });

// Virtual for profit margin
productSchema.virtual('profitMargin').get(function() {
  return this.sellingPrice - this.costPrice;
});

// Virtual for low stock status
productSchema.virtual('isLowStock').get(function() {
  return this.currentStock <= this.minStockLevel;
});

module.exports = mongoose.model('Product', productSchema);