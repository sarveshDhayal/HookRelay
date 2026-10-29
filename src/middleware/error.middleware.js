import { AppError } from '../utils/errors.js';

// Centralized error handling middleware
export function errorHandler(err, req, res, next) {
  // Catch bad JSON syntax in request bodies
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload',
    });
  }

  // Known operational application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Log unexpected errors for student debugging
  console.error('[Unhandled Error]', err);

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}
