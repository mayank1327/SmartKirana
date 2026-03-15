require('dotenv').config();

// Critical variables — server start hi nahi hoga agar missing
if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}

if (!process.env.MONGODB_URI) {
  throw new Error('FATAL: MONGODB_URI environment variable is required');
}

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  MONGODB_URI: process.env.MONGODB_URI,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '30d'
};