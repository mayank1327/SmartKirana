const authService = require('../services/authService');
// Thin layer 
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    
    const result = await authService.registerUser({ name, email, password });

    res.status(201).json({
      success: true,
      data: {
        token: result.token,
        user: result.data
      }
    });
  } catch (error) {
    next(error); 
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser({ email, password });

    res.status(200).json({
      success: true,
      data: {
        token: result.token,
        user: result.data
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  register, 
  login
};
