require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const importRouter = require('./routes/import');
const exchangeRateRouter = require('./routes/exchangeRate');
const productsRouter = require('./routes/products');
const batchesRouter = require('./routes/batches');
const salesRouter = require('./routes/sales');
const inventoryRouter = require('./routes/inventory');
const reportsRouter = require('./routes/reports');
const authMiddleware = require('./middleware/authMiddleware');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// In dev, the Vite proxy handles CORS. In prod, same origin — no CORS needed.
if (!IS_PROD) app.use(cors());
app.use(express.json());

// Public routes — no auth required
app.use('/api/auth', authRouter);

// All other API routes require a valid JWT
app.use('/api', authMiddleware);
app.use('/api/users', usersRouter);
app.use('/api/import', importRouter);
app.use('/api/exchange-rate', exchangeRateRouter);
app.use('/api/products', productsRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/sales', salesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/reports', reportsRouter);

// Serve built React app in production
if (IS_PROD) {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Auskorphi server running on http://localhost:${PORT} [${IS_PROD ? 'production' : 'development'}]`);
});
