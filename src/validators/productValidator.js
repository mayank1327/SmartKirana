const Joi = require('joi');

// Base validation rules (reusable)
const baseProductRules = {
  name: Joi.string().trim().max(100),
  unit: Joi.string().trim().lowercase(),
  costPrice: Joi.number().min(0),
  minSellingPrice: Joi.number().min(0),
  currentStock: Joi.number().min(0),
  minStockLevel: Joi.number().min(0),
  isActive: Joi.boolean()
};

// CREATE - all required
const createProductSchema = Joi.object({
  name: baseProductRules.name.required(),
  unit: baseProductRules.unit.required(),
  costPrice: baseProductRules.costPrice.required(),
  minSellingPrice: baseProductRules.minSellingPrice.required(),
  currentStock: baseProductRules.currentStock.required(),
  minStockLevel: baseProductRules.minStockLevel.required(),
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