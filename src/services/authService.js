const  generateToken = require('../utils/jwt');
const userRepository = require('../repositories/userRepository'); // Import the user repository
// Service orchestrates both to complete business operation -> depends on buth utils and repo 
class AuthService {
  // Register a new user
  async registerUser({ name, email, password, role }) {

    // No duplicate emails
    const existingUser = await userRepository.findByEmail(email); // Check if user already exists

    if (existingUser) { //TODO: Better to use custom error classes in real apps
      throw new Error('User already exists'); 
    }

    const user = await userRepository.create({ name, email, password, role }); // Create new user

    const token = generateToken(user._id); // Generate JWT token

    return {
      token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  }

  // Login existing user
  async loginUser({ email, password }) {

    const user = await userRepository.findByEmail(email, true); // Include password for comparison

    if (!user || !(await user.comparePassword(password))) { 
      throw new Error('Invalid credentials'); // TODO : Better to use custom error classes in real apps
    }

    const token = generateToken(user._id); // Generate JWT token

    return {
      token,
      data: { // ALTERNATIVE -> DTOs (Data Transfer Objects) for shaping response
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  }
}

module.exports = new AuthService();


// Future: Will you need:
// Password reset?
// Email verification?
// OAuth/social login?
// Update profile
// Account deletion?
// Refresh tokens?
// Two-factor authentication?
// Role-based access control?
// etc...