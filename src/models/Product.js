const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    trim: true,
    lowercase: true
    // No enum - full flexibility
  },
  costPrice: { 
    type: Number,
    required: [true, 'Cost price is required'],
    min: [0, 'Cost price must be positive']
  },
  minSellingPrice: { 
    type: Number,
    required: [true, 'Minimum Selling price is required'],
    min: [0, 'Minimum Selling price must be positive'],
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
    min: [0, 'Minimum stock level must be positive'], // Future enhancement: Let owner set per-product thresholds (already possible!).
    default: 10  
  },
  isActive: {
    type: Boolean,
    default: true
  },
}, {
  timestamps: true
});

// Indexes for better search performance
productSchema.index({ name: 'text'}); // Text index for search functionality
productSchema.index({ isActive: 1 }); // Filter active/inactive products
productSchema.index( { name: 1 },{ unique: true, partialFilterExpression: { isActive: true } }); // Ensure unique active product names (soft delete aware)

module.exports = mongoose.model('Product', productSchema);
// SKU = stock keeping unit 