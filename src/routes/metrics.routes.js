import { Router } from 'express';
import * as metricsController from '../controllers/metrics.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/overview', metricsController.getOverview);
router.get('/endpoints', metricsController.getEndpoints);

export default router;
