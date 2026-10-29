import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'node:crypto';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { deliveryWorker } from '../../src/workers/deliveryWorker.js';

describe('Full Webhook Lifecycle Integration (Event -> Fails -> Retries -> DEAD -> Replay)', () => {
  let apiServer;
  let failingServer;
  let baseUrl;
  let failingPort;
  let userToken;
  let failingEndpointId;

  before(async () => {
    // 1. Start a mock server that always crashes with 500
    const failingApp = express();
    failingApp.use(express.json());
    failingApp.post('/crash', (req, res) => {
      res.status(500).json({ error: 'Deliberate crash simulation' });
    });

    await new Promise((resolve) => {
      failingServer = failingApp.listen(0, () => {
        failingPort = failingServer.address().port;
        resolve();
      });
    });

    // 2. Start API server
    await new Promise((resolve) => {
      apiServer = app.listen(0, () => {
        const port = apiServer.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });

    // 3. Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student@hookrelay.dev',
        password: 'Password123!',
      }),
    });
    const loginBody = await loginRes.json();
    userToken = loginBody.data.accessToken;

    // 4. Register failing endpoint
    const epRes = await fetch(`${baseUrl}/endpoints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        url: `http://localhost:${failingPort}/crash`,
        description: 'Permanent Crash Endpoint',
        eventTypes: ['lifecycle.test'],
      }),
    });
    const epBody = await epRes.json();
    failingEndpointId = epBody.data.id;
  });

  after(async () => {
    deliveryWorker.stop();
    await new Promise((resolve) => apiServer.close(resolve));
    await new Promise((resolve) => failingServer.close(resolve));
    await prisma.$disconnect();
  });

  test('delivery transitions through retries to DEAD after exhausting max attempts', async () => {
    // 1. Ingest event
    const idemKey = `idem_lifecycle_${crypto.randomUUID()}`;
    const ingestRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        type: 'lifecycle.test',
        payload: { test: 'full-cycle', timestamp: Date.now() },
        idempotencyKey: idemKey,
      }),
    });

    assert.equal(ingestRes.status, 201);
    const ingestBody = await ingestRes.json();
    const delivery = ingestBody.data.deliveries.find(
      (d) => d.endpointId === failingEndpointId
    );
    assert.ok(delivery, 'Delivery created for failing endpoint');
    assert.equal(delivery.status, 'PENDING');
    assert.equal(delivery.retryCount, 0);

    // 2. Simulate 6 consecutive delivery failures through the worker
    for (let attempt = 1; attempt <= 6; attempt++) {
      const currentDel = await prisma.delivery.findUnique({
        where: { id: delivery.id },
        include: { event: true, endpoint: true },
      });

      // Dispatch delivery to failing receiver
      await deliveryWorker.dispatch(currentDel);

      const afterAttempt = await prisma.delivery.findUnique({
        where: { id: delivery.id },
        include: { attempts: true },
      });

      assert.equal(afterAttempt.attempts.length, attempt);
      assert.equal(afterAttempt.attempts[attempt - 1].statusCode, 500);

      if (attempt < 6) {
        assert.equal(afterAttempt.status, 'FAILED');
        assert.equal(afterAttempt.retryCount, attempt);
      } else {
        // 6th attempt: Must transition to DEAD!
        assert.equal(afterAttempt.status, 'DEAD');
        assert.equal(afterAttempt.retryCount, 6);
      }
    }

    // 3. Verify Circuit Breaker: consecutiveFailures >= 5 should auto-pause endpoint
    const endpointAfterFails = await prisma.webhookEndpoint.findUnique({
      where: { id: failingEndpointId },
    });
    assert.equal(endpointAfterFails.isPaused, true, 'Circuit breaker should pause endpoint after 5+ failures');
    assert.ok(endpointAfterFails.consecutiveFailures >= 5);

    // 4. Replay the DEAD delivery
    const replayRes = await fetch(`${baseUrl}/deliveries/${delivery.id}/replay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(replayRes.status, 200);
    const replayBody = await replayRes.json();
    assert.equal(replayBody.success, true);
    assert.equal(replayBody.data.status, 'PENDING');
    assert.equal(replayBody.data.retryCount, 0);
  });
});
