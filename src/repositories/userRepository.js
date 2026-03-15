const User = require('../models/User');

class UserRepository {
  
  async findByEmail(email, includePassword = false) {
    if (includePassword) {
       return User.findOne({ email: email.toLowerCase() }).select('+password');
       // Service doesn't know about select('+password') - that's Mongoose-specific
    }
    return User.findOne({ email: email.toLowerCase() });
  }

  async create(userData) {
    return User.create(userData);
  }

  async findById(id) {
    return User.findById(id);
  }
  
}

module.exports = new UserRepository(); // Singleton Pattern 
