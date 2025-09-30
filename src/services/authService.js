// src/services/authService.js
const User = require('../models/User');
const  generateToken = require('../utils/jwt');
const userRepository = require('../repositories/userRepository'); // Import the user repository

class AuthService {
  // Register a new user
  async registerUser({ name, email, password, role }) {
    const existingUser = await userRepository.findByEmail(email); 

    if (existingUser) {
      throw new Error('User already exists'); // Better to use custom error classes in real apps
    }

    const user = await userRepository.create({ name, email, password, role });

    const token = generateToken(user._id); 

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
      throw new Error('Invalid credentials'); // Better to use custom error classes in real apps
    }

    const token = generateToken(user._id);

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
}

module.exports = new AuthService();