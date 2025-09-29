const Joi = require('joi');

// Registration validation
const registerSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Valid Name is required to register'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Invalid email address',
    'string.empty': 'Email is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'string.empty': 'Password is must be at least 6 characters long'
  }),
  role: Joi.string().valid('owner', 'staff', 'manager').required().messages({
    'any.only': 'Role must be one of owner, staff, manager',
    'string.empty': 'Role is required'
  })
});

// Login validation
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Invalid email address',
    'string.empty': 'Email is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'string.empty': 'Password is required'
  })
});

module.exports = {
  registerSchema,
  loginSchema
};