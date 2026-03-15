const  generateToken = require('../utils/jwt');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

class AuthService {

  async registerUser({ name, email, password }) {

    const existingUser = await userRepository.findByEmail(email);

    if (existingUser) { 
        throw new AppError('User already exists', 400);
    }

    const user = await userRepository.create({ name, email, password }); 

    const token = generateToken(user._id);

    return {
      token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
      }
    };
  }

  async loginUser({ email, password }) {

    const user = await userRepository.findByEmail(email, true);
    // Include password for comparison

    
    if (!user || !(await user.comparePassword(password))) { 
        throw new AppError('Invalid credentials', 401);
    }// Same error for both cases — prevents user enumeration attack

    const token = generateToken(user._id);

    return {
      token,
      data: { // DTOs (Data Transfer Objects) for shaping response
        id: user._id,
        name: user.name,
        email: user.email,
      }
    };
  }
  
}

module.exports = new AuthService();
