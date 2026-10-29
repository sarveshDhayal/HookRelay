import { Router } from 'express';
import { z } from 'zod';
import * as endpointController from '../controllers/endpoint.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

const createEndpointSchema = z.object({
  url: z.string().url('Must be a valid HTTP or HTTPS URL'),
  description: z.string().max(255).optional(),
  eventTypes: z.array(z.string()).min(1, 'At least one event type or "*" required'),
});

const updateEndpointSchema = z.object({
  url: z.string().url('Must be a valid HTTP or HTTPS URL').optional(),
  description: z.string().max(255).optional(),
  eventTypes: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
});

// All endpoint management routes require authentication
router.use(requireAuth);

router.post('/', validate(createEndpointSchema), endpointController.create);
router.get('/', endpointController.list);
router.get('/:id', endpointController.getById);
router.put('/:id', validate(updateEndpointSchema), endpointController.update);
router.delete('/:id', endpointController.remove);

// Circuit breaker controls
router.post('/:id/resume', endpointController.resume);
router.post('/:id/pause', endpointController.pause);

export default router;

