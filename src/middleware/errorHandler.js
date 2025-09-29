const errorHandler = (err, req, res, next) => {
    console.log("error handler middleware me aa rha hai");
    console.error("error ka stack aa rha hai" + err.stack);
    
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  };
  
  module.exports = errorHandler;