const Joi = require('joi');

// Bill item schema (existing product)
const existingProductItemSchema = Joi.object({
  productId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Product ID must be a valid ObjectId',
    'any.required': 'Product ID is required for existing products'
  }),
  variationId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Variation ID must be a valid ObjectId',
    'any.required': 'Variation ID is required'
  }),
  quantity: Joi.number().positive().required().messages({
    'number.base': 'Quantity must be a number',
    'number.positive': 'Quantity must be greater than 0',
    'any.required': 'Quantity is required'
  }),
  pricePerUnit: Joi.number().min(0).required().messages({
    'number.base': 'Price per unit must be a number',
    'number.min': 'Price per unit cannot be negative',
    'any.required': 'Price per unit is required'
  }),
  lineTotal: Joi.number().min(0).optional().messages({
    'number.base': 'Line total must be a number',
    'number.min': 'Line total cannot be negative'
  }),
  tempProductName: Joi.forbidden()
});

// Bill item schema (temporary product)
const temporaryProductItemSchema = Joi.object({
  tempProductName: Joi.string().trim().max(100).required().messages({
    'string.empty': 'Product name is required',
    'string.max': 'Product name cannot exceed 100 characters',
    'any.required': 'Product name is required for temporary products'
  }),
  quantity: Joi.number().positive().required().messages({
    'number.base': 'Quantity must be a number',
    'number.positive': 'Quantity must be greater than 0',
    'any.required': 'Quantity is required'
  }),
  pricePerUnit: Joi.number().min(0).required().messages({
    'number.base': 'Price per unit must be a number',
    'number.min': 'Price per unit cannot be negative',
    'any.required': 'Price per unit is required'
  }),
  lineTotal: Joi.number().min(0).optional().messages({
    'number.base': 'Line total must be a number',
    'number.min': 'Line total cannot be negative'
  }),
  productId: Joi.forbidden(),
  variationId: Joi.forbidden()
});

// Bill item schema (accepts either type)
const billItemSchema = Joi.alternatives().try(
  existingProductItemSchema,
  temporaryProductItemSchema
).messages({
  'alternatives.match': 'Item must be either an existing product or temporary product'
});

// Create bill validation
const createBillSchema = Joi.object({
  billDate: Joi.date().iso().max('now').optional().messages({
    'date.base': 'Bill date must be a valid date',
    'date.max': 'Bill date cannot be in the future'
  }),
  customerName: Joi.string().trim().max(100).allow('', null).optional().messages({
    'string.max': 'Customer name cannot exceed 100 characters'
  }),
  items: Joi.array().items(billItemSchema).min(1).required().messages({
    'array.min': 'At least one item is required',
    'any.required': 'Items are required'
  }),
  discount: Joi.number().default(0).optional().messages({
    'number.base': 'Discount must be a number'
  })
});

// Get bills query validation
const getBillsQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional().messages({
    'date.base': 'Start date must be a valid date'
  }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().messages({
    'date.base': 'End date must be a valid date',
    'date.min': 'End date must be after start date'
  }),
  customerName: Joi.string().trim().optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20).optional()
});

// Bill ID param validation
const billIdParamSchema = Joi.object({
  billId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid bill ID format',
    'any.required': 'Bill ID is required'
  })
});

// Temp product ID param validation
const tempProductIdParamSchema = Joi.object({
  tempProductId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid temporary product ID format',
    'any.required': 'Temporary product ID is required'
  })
});

// Complete setup validation (reuse product creation schema)
const completeSetupSchema = Joi.object({
  productName: Joi.string().trim().max(100).required(),
  units: Joi.array().min(1).required(),
  variations: Joi.array().min(1).required(),
  minStockLevel: Joi.object({
    value: Joi.number().positive().required(),
    unit: Joi.string().required()
  }).optional().allow(null)
});

module.exports = {
  createBillSchema,
  getBillsQuerySchema,
  billIdParamSchema,
  tempProductIdParamSchema,
  completeSetupSchema
};