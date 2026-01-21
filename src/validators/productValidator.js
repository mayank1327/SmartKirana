const Joi = require('joi');

// Unit schema (for create)
const unitSchema = Joi.object({
  unitName: Joi.string().trim().required().messages({
    'string.empty': 'Unit name is required',
    'any.required': 'Unit name is required'
  }),
  isBase: Joi.boolean().required().messages({
    'any.required': 'isBase flag is required'
  })
});

// Variation schema (for create)
const variationSchema = Joi.object({
  unitName: Joi.string().trim().required().messages({
    'string.empty': 'Variation unit name is required',
    'any.required': 'Variation unit name is required'
  }),
  containsQuantity: Joi.number().positive().required().messages({
    'number.base': 'Contains quantity must be a number',
    'number.positive': 'Contains quantity must be greater than 0',
    'any.required': 'Contains quantity is required'
  }),
  containsUnit: Joi.string().trim().required().messages({
    'string.empty': 'Contains unit is required',
    'any.required': 'Contains unit is required'
  }),
  minSellingPrice: Joi.number().min(0).allow(null).optional().messages({
    'number.base': 'Minimum selling price must be a number',
    'number.min': 'Minimum selling price cannot be negative'
  })
});

// Min stock level schema
const minStockLevelSchema = Joi.object({
  value: Joi.number().positive().required().messages({
    'number.base': 'Min stock value must be a number',
    'number.positive': 'Min stock value must be greater than 0',
    'any.required': 'Min stock value is required'
  }),
  unit: Joi.string().trim().required().messages({
    'string.empty': 'Min stock unit is required',
    'any.required': 'Min stock unit is required'
  })
}).optional().allow(null);

// Create product validation
const createProductSchema = Joi.object({
  productName: Joi.string().trim().max(100).required().messages({
    'string.empty': 'Product name is required',
    'string.max': 'Product name cannot exceed 100 characters',
    'any.required': 'Product name is required'
  }),
  units: Joi.array().items(unitSchema).min(1).required().messages({
    'array.min': 'At least one unit is required',
    'any.required': 'Units are required'
  }),
  variations: Joi.array().items(variationSchema).min(1).required().messages({
    'array.min': 'At least one variation is required',
    'any.required': 'Variations are required'
  }),
  minStockLevel: minStockLevelSchema
});

// Update product validation (only allowed fields)
const updateProductSchema = Joi.object({
  productName: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Product name cannot exceed 100 characters'
  }),
  minStockLevel: Joi.number().min(0).optional().messages({
    'number.base': 'Minimum stock level must be a number',
    'number.min': 'Minimum stock level cannot be negative'
  }),
  isActive: Joi.boolean().optional(),
  variations: Joi.array().items(
    Joi.object({
      variationId: Joi.string().required().messages({
        'any.required': 'Variation ID is required'
      }),
      minSellingPrice: Joi.number().min(0).required().messages({
        'number.base': 'Minimum selling price must be a number',
        'number.min': 'Minimum selling price cannot be negative',
        'any.required': 'Minimum selling price is required'
      })
    })
  ).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Get products query validation
const getProductsQuerySchema = Joi.object({
  search: Joi.string().trim().optional(),
  lowStock: Joi.string().valid('true', 'false').optional(),
  isActive: Joi.string().valid('true', 'false').optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20).optional()
});

// Product ID param validation
const productIdParamSchema = Joi.object({
  id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid product ID format',
    'any.required': 'Product ID is required'
  })
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  getProductsQuerySchema,
  productIdParamSchema
};