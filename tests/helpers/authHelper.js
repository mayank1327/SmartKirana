const jwt = require('jsonwebtoken');
const User = require('../../src/models/User');

// Create test user and return token
async function createAuthenticatedUser(role = 'owner') {
  const user = await User.create({
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password: 'password123',
    role 
  });
  
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret');
  
  return { user, token };
}

module.exports = { createAuthenticatedUser };