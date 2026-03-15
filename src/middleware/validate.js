const validate = (schema, property = 'body') => (req, res, next) => {

    const { error, value } = schema.validate(req[property], { 
      abortEarly: false ,
    });
  
    if (error) {
      const messages = error.details.reduce((acc, detail) => {
        acc[detail.path.join('.')] = detail.message;
        return acc;
      }, {});
      return res.status(400).json({
        success: false,
        error: messages
      });
    }
  
    req[property] = value; // Controller receives CLEANED data automatically!
    next();
    
};
  
module.exports = validate;



