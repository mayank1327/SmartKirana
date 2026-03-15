const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 


const userSchema = new mongoose.Schema({

  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    unique: true,
    trim: true,
    match: [/.+@.+\..+/, 'Please enter a valid email'] 
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false 
  }

}, { timestamps: true });


// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next(); 
  this.password = await bcrypt.hash(this.password, 12); 
  next();
});

// Password comparison is core domain logic (always needed)
userSchema.methods.comparePassword = function(candidatePassword) { 
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);