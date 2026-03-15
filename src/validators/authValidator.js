const Joi = require('joi');

// FOLLOW DRY PRINCIPLE
const commonValidations = {
  email: Joi.string().trim().lowercase().email().required().messages({
    'string.email': 'Invalid email address',
    'string.empty': 'Email is required'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'string.empty': 'Password is required'
  })
};

const registerSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Valid Name is required to register'
  }),
  email: commonValidations.email,
  password: commonValidations.password,
});

const loginSchema = Joi.object({
  email: commonValidations.email,
  password:commonValidations.password
});

module.exports = {
  registerSchema,
  loginSchema
};