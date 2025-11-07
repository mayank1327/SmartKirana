// Update errorHandler middleware today , after some days we use custom error classes
const errorHandler = (err, req, res, next) => {
  console.log("🔥 Error captured by errorHandler middleware");
  
  // For cleaner testing logs (Jest)
  if (process.env.NODE_ENV === 'test') {
    console.error(err.message);
  } else {
    console.error(err.stack);
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      error: messages.join(', ')
    });
  }

  // Handle duplicate key errors (e.g., duplicate email)
  if (err.code && err.code === 11000) {
    const field = Object.keys(err.keyValue);
    return res.status(409).json({
      success: false,
      error: `${field} already exists`
    });
  }

  // Handle cast errors (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: `Invalid ${err.path}: ${err.value}`
    });
  }

  // Authentication or Authorization Errors
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Unauthorized access'
    });
  }

  

  // Bad Request Error (for client-side invalid input)
  if (err.statusCode === 400) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Bad request'
    });
  }

  // Conflict Error (duplicate or conflicting resource)
  if (err.statusCode === 409) {
    return res.status(409).json({
      success: false,
      error: err.message || 'Conflict error'
    });
  }


  // Fallback: unexpected or unhandled errors
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;