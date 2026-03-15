const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const billRoutes = require('./routes/billRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const temporaryProductRoutes = require('./routes/temporaryProductRoutes');
const reportRoutes = require('./routes/reportRoutes');
const healthRoutes = require('./routes/healthRoutes');

const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
// combined in production for full audit logs, dev for readable output
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/temporary-products', temporaryProductRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', healthRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;