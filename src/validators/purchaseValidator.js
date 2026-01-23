const Joi = require('joi');

// Purchase item schema
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
  costPricePerUnit: Joi.number().min(0).required().messages({
    'number.base': 'Cost price per unit must be a number',
    'number.min': 'Cost price per unit cannot be negative',
    'any.required': 'Cost price per unit is required'
  })
});

// Cost price change schema (for MSP review)
const costPriceChangeSchema = Joi.object({
  productId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Product ID must be a valid ObjectId',
    'any.required': 'Product ID is required'
  }),
  variations: Joi.array().items(
    Joi.object({
      variationId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Variation ID must be a valid ObjectId',
        'any.required': 'Variation ID is required'
      }),
      newMinSellingPrice: Joi.number().min(0).required().messages({
        'number.base': 'New minimum selling price must be a number',
        'number.min': 'New minimum selling price cannot be negative',
        'any.required': 'New minimum selling price is required'
      })
    })
  ).min(1).required().messages({
    'array.min': 'At least one variation MSP update is required'
  })
});

// Create purchase validation
const createPurchaseSchema = Joi.object({
  purchaseDate: Joi.date().iso().max('now').optional().messages({
    'date.base': 'Purchase date must be a valid date',
    'date.max': 'Purchase date cannot be in the future'
  }),
  supplierName: Joi.string().trim().max(100).allow('', null).optional().messages({
    'string.max': 'Supplier name cannot exceed 100 characters'
  }),
  supplierBillNumber: Joi.string().trim().max(50).allow('', null).optional().messages({
    'string.max': 'Supplier bill number cannot exceed 50 characters'
  }),
  notes: Joi.string().trim().max(500).allow('', null).optional().messages({
    'string.max': 'Notes cannot exceed 500 characters'
  }),
  items: Joi.array().items(purchaseItemSchema).min(1).required().messages({
    'array.min': 'At least one item is required',
    'any.required': 'Items are required'
  }),
  costPriceChanges: Joi.array().items(costPriceChangeSchema).optional()
});

// Get purchases query validation
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

// Purchase ID param validation
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