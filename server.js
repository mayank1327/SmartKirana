const app = require('./src/app');
const connectDB = require('./src/config/database');
const config = require('./src/config');

// Connect to DB first
connectDB(config.MONGODB_URI)
  .then(() => {
    // Start server only if DB connected
    app.listen(config.PORT, () => {
      console.log(`🚀 Server running in ${config.NODE_ENV} mode on port ${config.PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to DB. Server not started.', err.message);
    process.exit(1); 
  });