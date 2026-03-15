const app = require('./src/app');
const connectDB = require('./src/config/database');
const config = require('./src/config');

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

connectDB(config.MONGODB_URI)
  .then(() => {
    app.listen(config.PORT, () => {
      console.log(`Server running in ${config.NODE_ENV} mode on port ${config.PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to DB. Server not started.', err.message);
    process.exit(1);
  });