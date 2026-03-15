const mongoose = require('mongoose');

const connectDB = async (uri) => {
  await mongoose.connect(uri);
  console.log('MongoDB connected successfully');
};

module.exports = connectDB;