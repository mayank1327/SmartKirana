const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {

  if (process.env.NODE_ENV !== 'test') {
    console.error(err.stack);
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      error: messages.join(', ')
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      error: `${field} already exists`
    });
  }

  // Mongoose invalid ObjectId
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: `Invalid ${err.path}: ${err.value}`
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal Server Error'
  });

};

module.exports = errorHandler;