import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

// Express middleware to validate request body, query, or params using Zod
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // Collect first validation issue message for clean user feedback
        const issue = err.errors[0];
        const field = issue.path.join('.');
        const message = field ? `${field}: ${issue.message}` : issue.message;
        return next(new AppError(message, 422));
      }
      next(err);
    }
  };
}
