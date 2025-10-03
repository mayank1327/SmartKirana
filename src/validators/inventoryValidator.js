const Joi = require('joi');

// Common fields reused across schemas
const productId = Joi.string().hex().length(24).required().messages({
  'string.base': 'Product ID must be a string',
  'string.hex': 'Product ID must be a valid ObjectId',
  'string.length': 'Product ID must be 24 characters',
  'any.required': 'Product ID is required'
});

const quantity = Joi.number().positive().required().messages({
  'number.base': 'Quantity must be a number',
  'number.positive': 'Quantity must be greater than 0',
  'any.required': 'Quantity is required'
});

const reason = Joi.string().trim()
.valid('purchase', 'sale', 'damage', 'expired', 'theft', 'correction', 'return')
.required()
.messages({
  'any.only': 'Reason must be one of [purchase, sale, damage, expired, theft, correction, return]',
  'string.base': 'Reason must be a string',
  'any.required': 'Reason is required'
});

const reference = Joi.string().allow('', null);
const notes = Joi.string().allow('', null);

// Reusable limit validator
const limit = Joi.number()
  .integer()
  .min(1)
  .max(200)
  .default(20)
  .messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be an integer',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 200'
  });

// Reusable page validator
const page = Joi.number()
  .integer()
  .min(1)
  .default(1)
  .messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be at least 1'
});


// Schemas
const updateStock = Joi.object({
  productId,
  quantity,
  movementType: Joi.string().valid('IN', 'OUT', 'ADJUSTMENT').uppercase().required(),
  reason,
  reference,
  notes
});

const addStock = Joi.object({
  productId,
  quantity,
  reason,
  reference,
  notes
});

const reduceStock = Joi.object({
  productId,
  quantity,
  reason,
  reference,
  notes
});

const adjustStock = Joi.object({
  productId,
  newQuantity: Joi.number().min(0).required().messages({
    'number.min': 'Quantity cannot be negative'
  }),
  reason,
  notes
});

// 4. Query parameter validation
const getStockHistoryQuery = Joi.object({
  limit,
  page
});

const recentMovementsQuery = Joi.object({
  limit,
});

module.exports = {
  updateStock,
  addStock,
  reduceStock,
  adjustStock,
  getStockHistoryQuery,
  recentMovementsQuery
};