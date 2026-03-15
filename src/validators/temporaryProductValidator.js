const Joi = require('joi');

const getTempProductsQuerySchema = Joi.object({
  search: Joi.string().trim().optional()
});

const tempProductIdParamSchema = Joi.object({
  tempProductId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid temporary product ID format',
    'any.required': 'Temporary product ID is required'
  })
});

module.exports = {
  getTempProductsQuerySchema,
  tempProductIdParamSchema
};