import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';

describe('Events API & Idempotency Integration', () => {
  let server;
  let baseUrl;
  const demoApiKey = 'hr_live_demo_key_9876543210abcdef';

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });

  test('POST /events - rejects request without API key or auth token', async () => {
    const res = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order.created',
        payload: { id: 1 },
        idempotencyKey: 'test-no-auth',
      }),
    });

    assert.equal(res.status, 401);
  });

  test('POST /events - successfully ingests event and creates deliveries atomically', async () => {
    const idempotencyKey = `idem_${crypto.randomUUID()}`;

    const res = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': demoApiKey,
      },
      body: JSON.stringify({
        type: 'payment.succeeded',
        payload: {
          invoiceId: 'inv_4040',
          amount: 15000,
          currency: 'USD',
        },
        idempotencyKey,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.event.idempotencyKey, idempotencyKey);
    assert.ok(body.data.deliveriesCreated >= 1);

    // Verify in database that deliveries were created
    const createdEvent = await prisma.event.findUnique({
      where: { idempotencyKey },
      include: { deliveries: true },
    });
    assert.ok(createdEvent);
    assert.equal(createdEvent.deliveries.length, body.data.deliveriesCreated);
    assert.equal(createdEvent.deliveries[0].status, 'PENDING');
  });

  test('POST /events - enforces idempotency and does not create duplicate deliveries', async () => {
    const fixedKey = `idem_strict_${crypto.randomUUID()}`;
    const payload = { testRun: 1, message: 'Idempotency check' };

    // First call: Should succeed with 201 Created
    const res1 = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': demoApiKey,
      },
      body: JSON.stringify({
        type: 'order.created',
        payload,
        idempotencyKey: fixedKey,
      }),
    });
    assert.equal(res1.status, 201);
    const body1 = await res1.json();
    const eventId1 = body1.data.event.id;

    // Second call: Same idempotency key, should return 200 OK with duplicate: true
    const res2 = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': demoApiKey,
      },
      body: JSON.stringify({
        type: 'order.created',
        payload,
        idempotencyKey: fixedKey,
      }),
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.duplicate, true);
    assert.equal(body2.data.id, eventId1);

    // Verify database count: exactly 1 event should exist with this key
    const count = await prisma.event.count({
      where: { idempotencyKey: fixedKey },
    });
    assert.equal(count, 1);
  });

  test('GET /events - retrieves ingested events for the authenticated API key user', async () => {
    const res = await fetch(`${baseUrl}/events`, {
      headers: { 'X-API-Key': demoApiKey },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2);
  });
});

