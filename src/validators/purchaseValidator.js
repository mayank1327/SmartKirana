const Joi = require('joi');

const mspUpdateSchema = Joi.object({
  variationId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Variation ID must be a valid ObjectId',
    'any.required': 'Variation ID is required'
  }),
  newMinSellingPrice: Joi.number().integer().min(0).required().messages({
    'number.base': 'MSP must be a number',
    'number.min': 'MSP cannot be negative',
    'any.required': 'MSP is required'
  })
});

const purchaseItemSchema = Joi.object({
  productId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Product ID must be a valid ObjectId',
    'any.required': 'Product ID is required'
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
  costPricePerUnit: Joi.number().integer().min(0).required().messages({
    'number.base': 'Cost price per unit must be a number',
    'number.min': 'Cost price per unit cannot be negative',
    'any.required': 'Cost price per unit is required'
  }),
  mspUpdates: Joi.array().items(mspUpdateSchema).optional()
});

const createPurchaseSchema = Joi.object({
  purchaseDate: Joi.date().iso().max('now').optional().messages({
    'date.base': 'Purchase date must be a valid date',
    'date.max': 'Purchase date cannot be in the future'
  }),
  supplierName: Joi.string().trim().max(100).allow('', null).optional().messages({
    'string.max': 'Supplier name cannot exceed 100 characters'
  }),
  items: Joi.array().items(purchaseItemSchema).min(1).required().messages({
    'array.min': 'At least one item is required',
    'any.required': 'Items are required'
  }),
});

const getPurchasesQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional().messages({
    'date.base': 'Start date must be a valid date'
  }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().messages({
    'date.base': 'End date must be a valid date',
    'date.min': 'End date must be after start date'
  }),
  supplierName: Joi.string().trim().optional(),
  productName: Joi.string().trim().optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20).optional()
});

const purchaseIdParamSchema = Joi.object({
  purchaseId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid purchase ID format',
    'any.required': 'Purchase ID is required'
  })
});

module.exports = {
  createPurchaseSchema,
  getPurchasesQuerySchema,
  purchaseIdParamSchema
};