import { Router } from 'express';
import * as deliveryController from '../controllers/delivery.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Deliveries inspection and replay require authentication
router.use(requireAuth);

router.get('/', deliveryController.list);
router.get('/dead-letters', deliveryController.listDeadLetters);
router.get('/:id', deliveryController.getById);
router.post('/:id/replay', deliveryController.replay);

export default router;

