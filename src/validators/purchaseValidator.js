const Joi = require('joi');

// Common item schema
const itemSchema = Joi.object({
  productId: Joi.string().required().messages({
    'any.required': 'Product ID is required',
    'string.base': 'Product ID must be a string'
  }),
  productName: Joi.string().max(100).required().messages({
    'any.required': 'Product name is required',
    'string.base': 'Product name must be a string',
    'string.max': 'Product name cannot exceed 100 characters'
  }),
  unit: Joi.string().max(50).required().messages({
    'any.required': 'Unit is required',
    'string.base': 'Unit must be a string',
    'string.max': 'Unit cannot exceed 50 characters'
  }),
  quantity: Joi.number().integer().positive().required().messages({
    'any.required': 'Quantity is required',
    'number.base': 'Quantity must be a number',
    'number.positive': 'Quantity must be greater than 0'
  }),
  unitCost: Joi.number().positive().required().messages({
    'any.required': 'Unit cost is required',
    'number.base': 'Unit cost must be a number',
    'number.positive': 'Unit cost must be greater than 0'
  }),
  minSellingPrice: Joi.number().positive().required().messages({
    'any.required': 'Minimum selling price is required',
    'number.base': 'Minimum selling price must be a number',
    'number.positive': 'Minimum selling price must be greater than 0'
  }),
  
});

// Create purchase validation
const createPurchaseSchema = Joi.object({
 // OR if you want to require either a valid name or explicitly allow null
  supplierName: Joi.string().trim().max(100).allow(null).optional(),
  items: Joi.array().items(itemSchema).min(1).required()
    .messages({ 'array.min': 'At least one purchase item is required' }),
  paymentMode: Joi.string().valid('cash', 'credit', 'UPI', 'cheque').optional(),
  notes: Joi.string().allow('').optional()
});

// Query validation schema for filters
const getPurchasesQuerySchema = Joi.object({
  startDate: Joi.date().optional(),
  endDate: Joi.date()
    .optional()
    .when('startDate', {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref('startDate')).messages({
        'date.min': 'End date must be after start date'
      })
    }),
  productName: Joi.string().optional(),
  paymentMode: Joi.string().valid('cash', 'credit', 'UPI', 'cheque').optional(),
  supplierName: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

module.exports = {
  createPurchaseSchema,
  getPurchasesQuerySchema
};