import { Router } from 'express';
import { z } from 'zod';
import * as apiKeyController from '../controllers/apikey.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

const createApiKeySchema = z.object({
  name: z.string().min(2, 'Key name must be at least 2 characters long').max(64),
});

// All API key endpoints require JWT user authentication
router.use(requireAuth);

router.post('/', validate(createApiKeySchema), apiKeyController.create);
router.get('/', apiKeyController.list);
router.delete('/:id', apiKeyController.revoke);

export default router;

