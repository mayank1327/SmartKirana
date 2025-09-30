const Joi = require('joi');

// Product validation schema
const productSchema = Joi.object({
  name: Joi.string().trim().max(100).required(),
  category: Joi.string()
    .valid('grocery', 'dairy', 'snacks', 'beverages', 'household', 'personal-care', 'other')
    .required(),
  costPrice: Joi.number().min(0).required(),
  sellingPrice: Joi.number().min(0).required(),
  currentStock: Joi.number().min(0).required(),
  minStockLevel: Joi.number().min(0).required(),
  unit: Joi.string().valid('piece', 'kg', 'liter', 'packet', 'box').required(),
  isActive: Joi.boolean().optional()
})
  // Custom rule: sellingPrice >= costPrice
.custom((value, helpers) => {
    if (value.sellingPrice < value.costPrice) {
      return helpers.message('Selling price must be greater than or equal to cost price');
    }
    return value;
});

module.exports = { 
    productSchema 
};