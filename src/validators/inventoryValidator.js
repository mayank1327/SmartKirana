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

const reason = Joi.string().trim().required().messages({
  'string.base': 'Reason must be a string',
  'any.required': 'Reason is required'
});

const reference = Joi.string().allow('', null);
const notes = Joi.string().allow('', null);

// Schemas
const updateStock = Joi.object({
  productId,
  quantity,
  movementType: Joi.string().valid('IN', 'OUT', 'ADJUSTMENT').required(),
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

module.exports = {
  updateStock,
  addStock,
  reduceStock,
  adjustStock
};