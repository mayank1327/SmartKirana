const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../utils/AppError');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Not authorized to access this route', 401);
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = { _id: decoded.id };
    next(); 

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired, please login again', 401));
    }
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError('Not authorized to access this route', 401));
  }
};

module.exports = { protect };
