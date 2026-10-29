import { prisma } from '../db.js';
import { config } from '../config.js';
import { MinHeap } from '../utils/minHeap.js';
import { computeHmacSignature } from '../utils/crypto.js';
import { ExponentialBackoff } from './backoff.strategy.js';
import { eventBus } from '../utils/eventBus.js';

export class DeliveryWorker {
  constructor() {
    // Priority queue scheduling retries by earliest nextAttemptAt timestamp
    this.minHeap = new MinHeap(
      (a, b) => new Date(a.nextAttemptAt).getTime() - new Date(b.nextAttemptAt).getTime()
    );

    this.backoffStrategy = new ExponentialBackoff({
      baseMs: 5000,
      factor: 2,
      maxDelayMs: 300000,
      withJitter: true,
    });

    this.isRunning = false;
    this.pollTimer = null;
    this.processTimer = null;
    this.activeDeliveries = 0;
    this.maxConcurrent = 10;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Worker] Delivery Worker started with MinHeap scheduler');

    // Main polling loop: checks MySQL queue for due deliveries
    this.pollLoop();

    // Heap processing loop: checks if top of heap is ready for dispatch
    this.processLoop();
  }

  stop() {
    this.isRunning = false;
    clearTimeout(this.pollTimer);
    clearTimeout(this.processTimer);
    console.log('[Worker] Delivery Worker stopped');
  }

  async pollLoop() {
    if (!this.isRunning) return;

    try {
      await this.pollDueDeliveries();
    } catch (err) {
      console.error('[Worker Poll Error]', err.message);
    }

    if (this.isRunning) {
      this.pollTimer = setTimeout(() => this.pollLoop(), config.worker.pollIntervalMs);
    }
  }

  async pollDueDeliveries() {
    // If heap already has plenty of jobs, let it drain before polling more
    if (this.minHeap.size() >= 50) return;

    const now = new Date();

    // Query due jobs where status is PENDING or FAILED and endpoint is not paused
    const dueJobs = await prisma.delivery.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        nextAttemptAt: { lte: now },
        endpoint: {
          isActive: true,
          isPaused: false,
        },
      },
      include: {
        event: true,
        endpoint: true,
      },
      take: config.worker.batchSize,
      orderBy: { nextAttemptAt: 'asc' },
    });

    if (dueJobs.length === 0) return;

    const jobIds = dueJobs.map((j) => j.id);

    // Atomically transition fetched jobs to PROCESSING to prevent duplicate pickup
    await prisma.delivery.updateMany({
      where: { id: { in: jobIds } },
      data: { status: 'PROCESSING' },
    });

    // Enqueue into in-memory MinHeap
    for (const job of dueJobs) {
      this.minHeap.push(job);
    }
  }

  processLoop() {
    if (!this.isRunning) return;

    while (
      !this.minHeap.isEmpty() &&
      this.activeDeliveries < this.maxConcurrent
    ) {
      const topJob = this.minHeap.peek();
      const now = Date.now();
      const jobTime = new Date(topJob.nextAttemptAt).getTime();

      if (jobTime <= now) {
        const job = this.minHeap.pop();
        this.activeDeliveries++;
        this.dispatch(job).finally(() => {
          this.activeDeliveries--;
        });
      } else {
        // Earliest job is not due yet; wait until its timestamp
        break;
      }
    }

    if (this.isRunning) {
      // Small tick check (100ms) for high temporal accuracy
      this.processTimer = setTimeout(() => this.processLoop(), 100);
    }
  }

  async dispatch(delivery) {
    const startTime = Date.now();
    const attemptNumber = delivery.retryCount + 1;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadString = JSON.stringify(delivery.event.payload);

    // Generate HMAC-SHA256 signature: HMAC(secret, timestamp + "." + body)
    const signature = computeHmacSignature(
      delivery.endpoint.secret,
      timestamp,
      payloadString
    );

    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      config.worker.deliveryTimeoutMs
    );

    let statusCode = null;
    let responseBody = null;
    let errorText = null;

    try {
      const response = await fetch(delivery.endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HookRelay-Worker/1.0',
          'X-HookRelay-Signature': signature,
          'X-HookRelay-Timestamp': timestamp,
          'X-HookRelay-Event-Id': delivery.eventId,
          'X-HookRelay-Delivery-Id': delivery.id,
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);
      statusCode = response.status;
      const text = await response.text();
      responseBody = text.slice(0, 500); // Store first 500 chars snippet

      if (response.ok) {
        // 2xx Success!
        await this.handleSuccess(delivery, attemptNumber, statusCode, responseBody, Date.now() - startTime);
        return;
      }

      // Non-2xx response (4xx or 5xx)
      errorText = `HTTP ${statusCode}: ${responseBody || response.statusText}`;
      await this.handleFailure(delivery, attemptNumber, statusCode, responseBody, errorText, Date.now() - startTime);
    } catch (err) {
      clearTimeout(timeoutHandle);
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      errorText = isTimeout
        ? `Request timed out after ${config.worker.deliveryTimeoutMs}ms`
        : `Network Error: ${err.message}`;

      await this.handleFailure(delivery, attemptNumber, null, null, errorText, latencyMs);
    }
  }

  async handleSuccess(delivery, attemptNumber, statusCode, responseBody, latencyMs) {
    // 1. Record attempt in audit log
    await prisma.deliveryAttempt.create({
      data: {
        deliveryId: delivery.id,
        attemptNumber,
        statusCode,
        responseBody,
        latencyMs,
      },
    });

    // 2. Mark delivery COMPLETED
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // 3. Reset endpoint circuit breaker counter
    await prisma.webhookEndpoint.update({
      where: { id: delivery.endpointId },
      data: { consecutiveFailures: 0 },
    });

    // 4. Notify observer listeners
    eventBus.emit('delivery.succeeded', {
      deliveryId: delivery.id,
      endpointId: delivery.endpointId,
      attemptNumber,
      latencyMs,
    });
  }

  async handleFailure(delivery, attemptNumber, statusCode, responseBody, errorText, latencyMs) {
    // 1. Record attempt in audit log
    await prisma.deliveryAttempt.create({
      data: {
        deliveryId: delivery.id,
        attemptNumber,
        statusCode,
        responseBody,
        error: errorText,
        latencyMs,
      },
    });

    // 2. Update circuit breaker consecutive failures
    const updatedEndpoint = await prisma.webhookEndpoint.update({
      where: { id: delivery.endpointId },
      data: {
        consecutiveFailures: { increment: 1 },
      },
    });

    // Trip circuit breaker if threshold reached (5 failures)
    if (updatedEndpoint.consecutiveFailures >= config.worker.circuitBreakerThreshold) {
      await prisma.webhookEndpoint.update({
        where: { id: delivery.endpointId },
        data: { isPaused: true },
      });
      eventBus.emit('endpoint.paused', {
        endpointId: delivery.endpointId,
        consecutiveFailures: updatedEndpoint.consecutiveFailures,
      });
      console.warn(`[Circuit Breaker] Endpoint ${delivery.endpointId} automatically PAUSED after ${updatedEndpoint.consecutiveFailures} failures`);
    }

    // 3. Check retry count vs maxAttempts (DLQ vs Retry)
    if (attemptNumber >= delivery.maxAttempts) {
      // Exhausted retries -> Dead Letter Queue (DEAD)
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          status: 'DEAD',
          retryCount: attemptNumber,
        },
      });

      eventBus.emit('delivery.dead', {
        deliveryId: delivery.id,
        endpointId: delivery.endpointId,
        attempts: attemptNumber,
      });
    } else {
      // Calculate next backoff with jitter using strategy
      const delayMs = this.backoffStrategy.getDelayMs(attemptNumber);
      const nextAttemptAt = new Date(Date.now() + delayMs);

      await prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          retryCount: attemptNumber,
          nextAttemptAt,
        },
      });

      eventBus.emit('delivery.failed', {
        deliveryId: delivery.id,
        endpointId: delivery.endpointId,
        attemptNumber,
        nextAttemptAt,
        error: errorText,
      });
    }
  }
}

// Worker singleton
export const deliveryWorker = new DeliveryWorker();

