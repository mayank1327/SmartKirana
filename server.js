const dotenv = require('dotenv');
const app = require('./src/app');
const connectDB = require('./src/config/database');
const config = require('./src/config');

dotenv.config();

// connect to DB..
connectDB();

// Start server
app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
});