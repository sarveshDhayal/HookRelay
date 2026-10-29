import { Router } from 'express';
import { z } from 'zod';
import * as eventController from '../controllers/event.controller.js';
import { requireApiKey } from '../middleware/apiKey.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { rateLimiter } from '../middleware/rateLimiter.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

const ingestEventSchema = z.object({
  type: z.string().min(2, 'Event type must be at least 2 characters long').max(100),
  payload: z.record(z.any()).refine((obj) => Object.keys(obj).length > 0, {
    message: 'Payload must be a non-empty JSON object',
  }),
  idempotencyKey: z
    .string()
    .min(1, 'Idempotency key is required')
    .max(128, 'Idempotency key max length is 128 characters'),
});

// Middleware supporting both API Key (for external backend services) and JWT (for dashboard users)
function requireApiKeyOrAuth(req, res, next) {
  const hasApiKey =
    req.headers['x-api-key'] ||
    (req.headers['authorization'] && req.headers['authorization'].includes('hr_live_'));

  if (hasApiKey) {
    return requireApiKey(req, res, next);
  }
  return requireAuth(req, res, next);
}

// Ingestion endpoint (protected by API key or JWT, and bounded by TokenBucket rate limiter)
router.post('/', requireApiKeyOrAuth, rateLimiter, validate(ingestEventSchema), eventController.ingest);

// Inspection endpoints for dashboard and developers
router.get('/', requireApiKeyOrAuth, eventController.list);
router.get('/:id', requireApiKeyOrAuth, eventController.getById);

export default router;

