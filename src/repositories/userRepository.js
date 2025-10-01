const User = require('../models/User');

class UserRepository {
  // Find user by email
  async findByEmail(email, includePassword = false) {
    if (includePassword) {
      return User.findOne({ email }).select('+password'); // Service doesn't know about select('+password') - that's Mongoose-specific
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

module.exports = new UserRepository(); // Singleton Pattern 

// Future needs: Will you need:
// List all users (admin panel)?
// Update user profile?
// Soft delete (mark inactive instead of delete)?