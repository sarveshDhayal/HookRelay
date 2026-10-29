import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware.js';
import { AppError } from './utils/errors.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import apiKeyRoutes from './routes/apikey.routes.js';
import endpointRoutes from './routes/endpoint.routes.js';
import eventRoutes from './routes/event.routes.js';
import deliveryRoutes from './routes/delivery.routes.js';
import metricsRoutes from './routes/metrics.routes.js';

export const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// Request logger for development
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'HookRelay API',
    timestamp: new Date().toISOString(),
  });
});

// Mount V1 API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/endpoints', endpointRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/v1/events', eventRoutes); // Direct alias for convenience
app.use('/api/v1/deliveries', deliveryRoutes);
app.use('/v1/deliveries', deliveryRoutes); // Direct alias for replay endpoint
app.use('/api/v1/metrics', metricsRoutes);

// Catch-all for undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Endpoint ${req.originalUrl} not found on this server`, 404));
});

// Centralized error handler
app.use(errorHandler);

