import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:4000',
  
  databaseUrl: process.env.DATABASE_URL,
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_change_me',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  worker: {
    pollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '1000', 10),
    batchSize: parseInt(process.env.WORKER_BATCH_SIZE || '20', 10),
    deliveryTimeoutMs: parseInt(process.env.DELIVERY_TIMEOUT_MS || '10000', 10),
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
  },

  mockReceiverPort: parseInt(process.env.MOCK_RECEIVER_PORT || '4001', 10),
};
