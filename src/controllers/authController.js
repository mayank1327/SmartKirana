const authService = require('../services/authService');
// Thin layer 
const register = async (req, res, next) => {
  try {
    // 1. Extract data from HTTP request
    const { name, email, password, role } = req.body;
    
    // 2. Call service (business logic)
    const result = await authService.registerUser({ name, email, password, role });

    // // 3. Send HTTP response
    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error); // 4. Pass error to middleware
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser({ email, password });

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  register, 
  login
};

// Missing (handled by error middleware):
// 400 Bad Request - Validation errors, duplicate user
// 401 Unauthorized - Invalid credentials
// 500 Internal Server Error - Unexpected errors