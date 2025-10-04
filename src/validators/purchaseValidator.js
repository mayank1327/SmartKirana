const Joi = require('joi');

// Common item schema
const itemSchema = Joi.object({
  productId: Joi.string().required().messages({
    'any.required': 'Product ID is required',
    'string.base': 'Product ID must be a string'
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
  })
});

// Supplier schema
const supplierSchema = Joi.object({
  name: Joi.string().required().messages({
    'any.required': 'Supplier name is required'
  }),
  contactPerson: Joi.string().max(100).allow('', null),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).allow('', null).messages({
    'string.pattern.base': 'Invalid phone number format'
  }),
  address: Joi.string().max(300).allow('', null)
});

// Create purchase validation
const createPurchaseSchema = Joi.object({
  supplier: supplierSchema.required(),
  items: Joi.array().items(itemSchema).min(1).required()
    .messages({ 'array.min': 'At least one purchase item is required' }),
  tax: Joi.number().min(0).max(100).default(0),
  discount: Joi.number().min(0).default(0),
  paymentDueDate: Joi.date().optional(),
  invoiceNumber: Joi.string().optional(),
  notes: Joi.string().allow('').optional()
});

// Update payment schema
const updatePaymentSchema = Joi.object({
  paidAmount: Joi.number().min(0).required().messages({
    'any.required': 'Paid amount is required',
    'number.min': 'Paid amount must be >= 0'
  }),
  paymentStatus: Joi.string().valid('pending', 'partial', 'paid').optional(),
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
  paymentStatus: Joi.string().valid('pending', 'partial', 'paid').optional(),
  deliveryStatus: Joi.string().valid('pending', 'partial', 'delivered').optional(),
  supplier: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

module.exports = {
  createPurchaseSchema,
  updatePaymentSchema,
  getPurchasesQuerySchema
};