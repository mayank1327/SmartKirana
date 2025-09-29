// Generic validation middleware
const validate = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
  
    if (error) {
      // Return all errors in one response
      const messages = error.details.map(detail => detail.message);
      return res.status(400).json({ success: false, errors: messages });
    }
  
    // Replace req.body with validated value
    req.body = value;
    next();
  };
  
  module.exports = validate;