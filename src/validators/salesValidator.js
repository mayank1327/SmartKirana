const Joi = require('joi');

// Item schema (each product in sale)
const saleItemSchema = Joi.object({
  productId: Joi.string().required().messages({
    'string.empty': 'Product ID is required'
  }),
  quantity: Joi.number().integer().min(1).required().messages({
    'number.min': 'Quantity must be at least 1'
  })
});

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .message('Invalid ObjectId')
  .required();


// Sale creation schema
const createSaleSchema = Joi.object({
  items: Joi.array().items(saleItemSchema).min(1).required(),
  customerInfo: Joi.object({
    name: Joi.string().allow('', null),
    email: Joi.string().email().allow('', null),
    phone: Joi.string().allow('', null)
  }).optional(),
  paymentMethod: Joi.string().valid('cash', 'card', 'upi', 'credit').required(),
  tax: Joi.number().min(0).max(100),  // Tax can't exceed 100%
  // discount: Joi.number().min(0).max(Joi.ref('subtotal')),  // Can't exceed subtotal (needs custom validator)
 // Conditional validation
  creditAmount: Joi.when('paymentMethod', {
  is: 'credit',
  then: Joi.number().min(1).required(),  // Credit sales must have creditAmount
  otherwise: Joi.number().min(0).default(0)
  }),
  notes: Joi.string().allow('', null)
});

// Query schema for fetching sales
const getSalesQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  paymentMethod: Joi.string().valid('cash', 'card', 'upi', 'credit').optional(),
  paymentStatus: Joi.string().valid('paid', 'partial').optional(),
  soldBy: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

const getSaleByIdSchema = Joi.object({
  id: objectId
});

module.exports = {
  createSaleSchema,
  getSalesQuerySchema,
  getSaleByIdSchema
};