import { prisma } from '../db.js';
import { config } from '../config.js';
import { eventBus } from '../utils/eventBus.js';

// Circuit Breaker Service (System Design Coursework)
// Protects downstream subscriber services from repeated hammering when they are down.
// State Model:
//   - CLOSED: Normal operation, consecutiveFailures < 5
//   - OPEN / PAUSED: Endpoint automatically paused when consecutiveFailures >= 5
//   - RESET / RESUMED: User inspects receiver, fixes bug, and clicks "Resume"

export class CircuitBreakerService {
  constructor(threshold = config.worker.circuitBreakerThreshold) {
    this.threshold = threshold;
    this.setupListeners();
  }

  setupListeners() {
    // Observer pattern: Listen to delivery failure events emitted by the worker
    eventBus.on('delivery.failed', async (data) => {
      // The worker already increments consecutiveFailures and trips if >= threshold
    });

    eventBus.on('delivery.succeeded', async (data) => {
      // Worker resets consecutiveFailures to 0 on success
    });
  }

  // Get circuit status summary for a user or admin
  async getCircuitSummary(userId, userRole) {
    const where = userRole === 'ADMIN' ? {} : { userId };

    const endpoints = await prisma.webhookEndpoint.findMany({
      where,
      select: {
        id: true,
        url: true,
        description: true,
        isActive: true,
        isPaused: true,
        consecutiveFailures: true,
      },
    });

    const total = endpoints.length;
    const paused = endpoints.filter((e) => e.isPaused).length;
    const degraded = endpoints.filter((e) => !e.isPaused && e.consecutiveFailures > 0).length;
    const healthy = endpoints.filter((e) => !e.isPaused && e.consecutiveFailures === 0).length;

    return {
      total,
      healthy,
      degraded,
      paused,
      endpoints,
    };
  }

  // Manually resume an endpoint
  async resume(endpointId) {
    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        isPaused: false,
        consecutiveFailures: 0,
      },
    });

    eventBus.emit('endpoint.resumed', { endpointId });
    return endpoint;
  }
}

export const circuitBreakerService = new CircuitBreakerService();
