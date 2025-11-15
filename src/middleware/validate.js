// Generic validation middleware
const validate = (schema, property = 'body') => (req, res, next) => {
    const { error, value } = schema.validate(req[property], { 
      abortEarly: false ,
    });
  
    if (error) {
      // Return all errors in one response
      const messages = error.details.reduce((acc, detail) => { // refinement
        acc[detail.path[0]] = detail.message; 
        return acc;
      }, {});
      return res.status(400).json({ success: false, errors: messages });
    }
  
    // Replace req.body with validated value
    req[property] = value; // Controller receives CLEANED data automatically!

    next();
  };
  
  module.exports = validate;