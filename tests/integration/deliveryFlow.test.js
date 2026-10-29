import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'node:crypto';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { deliveryWorker } from '../../src/workers/deliveryWorker.js';
import { verifyHmacSignature } from '../../src/utils/crypto.js';

describe('Delivery Worker & Mock Flow Integration', () => {
  let apiServer;
  let mockServer;
  let baseUrl;
  let mockPort;
  let receivedWebhooks = [];
  let userToken;
  let endpointSecret;
  let endpointId;

  before(async () => {
    // 1. Start mock receiver server
    const mockApp = express();
    mockApp.use(express.json());
    mockApp.post('/target', (req, res) => {
      receivedWebhooks.push({
        headers: req.headers,
        body: req.body,
      });
      res.status(200).json({ ok: true });
    });

    await new Promise((resolve) => {
      mockServer = mockApp.listen(0, () => {
        mockPort = mockServer.address().port;
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

    // 3. Login as developer
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student@hookrelay.dev',
        password: 'Password123!',
      }),
    });
    const loginData = await loginRes.json();
    userToken = loginData.data.accessToken;

    // 4. Register mock receiver endpoint
    const epRes = await fetch(`${baseUrl}/endpoints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        url: `http://localhost:${mockPort}/target`,
        description: 'Automated Worker Target',
        eventTypes: ['worker.test'],
      }),
    });
    const epData = await epRes.json();
    endpointId = epData.data.id;
    endpointSecret = epData.data.secret;
  });

  after(async () => {
    deliveryWorker.stop();
    await new Promise((resolve) => apiServer.close(resolve));
    await new Promise((resolve) => mockServer.close(resolve));
    await prisma.$disconnect();
  });

  test('Worker successfully processes delivery with valid HMAC signature and records attempt', async () => {
    receivedWebhooks = [];

    // Ingest event
    const idemKey = `idem_worker_${crypto.randomUUID()}`;
    const ingestRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        type: 'worker.test',
        payload: { greeting: 'Hello HookRelay Worker!', timestamp: Date.now() },
        idempotencyKey: idemKey,
      }),
    });

    assert.equal(ingestRes.status, 201);
    const ingestBody = await ingestRes.json();
    const deliveryId = ingestBody.data.deliveries[0].id;

    // Start worker cycle manually or let worker process
    deliveryWorker.start();

    // Poll database until delivery status becomes COMPLETED (up to 4s)
    let completed = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: { attempts: true },
      });

      if (delivery && delivery.status === 'COMPLETED') {
        completed = true;
        assert.equal(delivery.attempts.length, 1);
        assert.equal(delivery.attempts[0].statusCode, 200);
        assert.ok(delivery.attempts[0].latencyMs >= 0);
        break;
      }
    }

    assert.equal(completed, true, 'Delivery should be marked COMPLETED by worker');
    assert.equal(receivedWebhooks.length, 1, 'Mock receiver should receive exactly 1 webhook');

    // Verify HMAC signature received by mock receiver
    const received = receivedWebhooks[0];
    const signature = received.headers['x-hookrelay-signature'];
    const timestamp = received.headers['x-hookrelay-timestamp'];
    assert.ok(signature, 'Signature header present');
    assert.ok(timestamp, 'Timestamp header present');

    const isValidSig = verifyHmacSignature(
      endpointSecret,
      timestamp,
      JSON.stringify(received.body),
      signature
    );
    assert.equal(isValidSig, true, 'HMAC signature verified successfully');
  });

  test('POST /deliveries/:id/replay - successfully replays dead-letter delivery', async () => {
    // Find a DEAD delivery from seed
    const deadDelivery = await prisma.delivery.findFirst({
      where: { status: 'DEAD' },
    });

    assert.ok(deadDelivery, 'Dead delivery exists in database');

    const replayRes = await fetch(`${baseUrl}/deliveries/${deadDelivery.id}/replay`, {
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

