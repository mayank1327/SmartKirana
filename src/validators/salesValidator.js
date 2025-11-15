const Joi = require('joi');

// Validation for creating a sale
const createSaleSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
        .messages({
            'string.pattern.base': 'Product ID must be a valid MongoDB ObjectId',
            'any.required': 'Product ID is required'
          }),
        quantity: Joi.number().integer().min(1).required()
          .messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be at least 1',
            'any.required': 'Quantity is required'
          }),
        unitPrice: Joi.number().positive().precision(2).required()
          .messages({
            'number.base': 'Unit price must be a number',
            'number.positive': 'Unit price must be a positive number',
            'any.required': 'Unit price is required'
          })
      })
    )
    .min(1).required()
    .messages({
      'array.min': 'Sale must contain at least one item',
      'any.required': 'Items are required'
    }),
  
  customerName: Joi.string()
    .trim()
    .max(100)
    .allow('', null)
    .optional()
    .messages({
      'string.max': 'Customer name cannot exceed 100 characters'
    }),
  
  paymentMethod: Joi.string()
    .valid('cash', 'upi', 'credit')
    .lowercase()
    .default('cash')
    .messages({
      'any.only': 'Payment method must be one of: cash, upi, credit'
    }),
  
  soldBy: Joi.forbidden()
});

// Validation for getting sales (query parameters)
const getSalesSchema = Joi.object({
  startDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.base': 'Start date must be a valid date',
      'date.format': 'Start date must be in ISO format'
    }),
  
  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.format': 'End date must be in ISO format',
      'date.min': 'End date must be after start date'
    }),
  
  paymentMethod: Joi.string()
    .valid('cash', 'upi', 'credit')
    .lowercase()
    .optional()
    .messages({
      'any.only': 'Payment method must be one of: cash, upi, credit'
    }),
  
  soldBy: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Sold by must be a valid MongoDB ObjectId'
    }),
  
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.min': 'Page must be at least 1'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    })
});

// Validation for sale ID parameter
const saleIdSchema = Joi.object({
  saleId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Sale ID must be a valid MongoDB ObjectId',
      'any.required': 'Sale ID is required'
    })
});

// Validation for daily sales date parameter
const dailySalesSchema = Joi.object({
  date: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.base': 'Date must be a valid date',
      'date.format': 'Date must be in ISO format'
    })
});

// Validation for sales analytics days parameter
const salesAnalyticsSchema = Joi.object({
  days: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(7)
    .messages({
      'number.base': 'Days must be a number',
      'number.min': 'Days must be at least 1',
      'number.max': 'Days cannot exceed 365'
    })
});


module.exports = {
  createSaleSchema,
  getSalesSchema,
  saleIdSchema,
  dailySalesSchema,
  salesAnalyticsSchema,
};