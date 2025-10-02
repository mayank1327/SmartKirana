const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true // Removes leading/trailing whitespace
  },
  email: {
    type: String,
    required: [true, 'Email is required'], // Validation ->  Mongoose validates before saving
    unique: true, // DB constraint ->  MongoDB enforces at DB level (prevents duplicates)
    index: true,  // Performance optimization -> Faster queries on email (for login lookups)
    lowercase: true,
    match: [/.+@.+\..+/, 'Please enter a valid email'] // Most of the devs prefer this and joi validation for complex
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // CRITICAL: Excludes from queries by default
  },
  role: {
    type: String,
    enum: ['owner', 'staff', 'manager'],
    required : [true, 'Role is required']
  }
}, {
  timestamps: true // Automatically manage createdAt and updatedAt fields
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next(); // Only hash if password is modified or new
  this.password = await bcrypt.hash(this.password, 12); // Hashing password with salt of 12 rounds
  next();
});

// Compare password method  // Password comparison is core domain logic (always needed)
userSchema.methods.comparePassword = async function(candidatePassword) { 
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);