const User = require('../models/User');

class UserRepository {
  // Find user by email
  async findByEmail(email, includePassword = false) {
    if (includePassword) {
      return User.findOne({ email }).select('+password');
    }
    return User.findOne({ email });
  }

  // Create new user
  async create(userData) {
    return User.create(userData);
  }

  // Optional: Find user by ID
  async findById(id) {
    return User.findById(id);
  }
}

module.exports = new UserRepository();