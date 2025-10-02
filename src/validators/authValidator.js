const Joi = require('joi');

// Better approach : // FOLLOW DRY PRINCIPLE
const commonValidations = {
  email: Joi.string().email().required().messages({
    'string.email': 'Invalid email address',
    'string.empty': 'Email is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'string.empty': 'Password is required'
  })
};

// Registration validation
const registerSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Valid Name is required to register'
  }),
  email: commonValidations.email,
  password: commonValidations.password,
  role: Joi.string().valid('owner', 'staff', 'manager').required().messages({
    'any.only': 'Role must be one of owner, staff, manager',
    'string.empty': 'Role is required'
  })
});

// Login validation
const loginSchema = Joi.object({
  email: commonValidations.email,
  password:commonValidations.password
});

module.exports = {
  registerSchema,
  loginSchema
};