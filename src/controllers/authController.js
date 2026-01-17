const authService = require('../services/authService');
// Thin layer 
const register = async (req, res, next) => {
  try {
    // 1. Extract data from HTTP request
    const { name, email, password, role } = req.body;
    
    // 2. Call service (business logic)
    const result = await authService.registerUser({ name, email, password, role });

    // // 3. Send HTTP response
      // Send proper user object
      res.status(201).json({
        success: true,
        token : result.token,
        user: result.data,
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
      token: result.token,
      user: result.data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  register, 
  login
};
