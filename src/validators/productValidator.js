const Joi = require('joi');

// Base validation rules (reusable)
const baseProductRules = {
  name: Joi.string().trim().max(100),
  // category: Joi.string().valid('grocery', 'dairy', 'snacks', 'beverages', 'household', 'personal-care', 'other'),
  costPrice: Joi.number().min(0),
  sellingPrice: Joi.number().min(0),
  currentStock: Joi.number().min(0),
  minStockLevel: Joi.number().min(0),
  unit: Joi.string().valid('piece', 'kg', 'liter', 'packet', 'box'),
  isActive: Joi.boolean()
};

// CREATE - all required
const createProductSchema = Joi.object({
  name: baseProductRules.name.required(),
  // category: baseProductRules.category.required(),
  costPrice: baseProductRules.costPrice.required(),
  sellingPrice: baseProductRules.sellingPrice.required(),
  currentStock: baseProductRules.currentStock.required(),
  minStockLevel: baseProductRules.minStockLevel.required(),
  unit: baseProductRules.unit.required(),
  isActive: baseProductRules.isActive
}).custom((value, helpers) => {
  if (value.sellingPrice < value.costPrice) {
    return helpers.message('Selling price must be greater than or equal to cost price');
  }
  return value;
});

// UPDATE - all optional, at least one required
const updateProductSchema = Joi.object(baseProductRules)
  .min(1)
  .custom((value, helpers) => {
    // Only validate price relationship if both are provided
    if (value.sellingPrice !== undefined && value.costPrice !== undefined) {
      if (value.sellingPrice < value.costPrice) {
        return helpers.message('Selling price must be greater than or equal to cost price');
      }
    }
    return value;
  });

module.exports = { 
  createProductSchema, 
  updateProductSchema 
};