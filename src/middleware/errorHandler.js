const errorHandler = (err, req, res, next) => {
    console.error("error ka stack aa rha hai" + err.stack);
    
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Server Error'
    });
  };
  
  module.exports = errorHandler;