import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';

describe('Auth & Endpoints API Integration', () => {
  let server;
  let baseUrl;
  let devAccessToken;
  let adminAccessToken;
  let devUserId;

  before(async () => {
    // Start server on a dynamic port
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

  test('POST /auth/login - authenticate seeded developer', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student@hookrelay.dev',
        password: 'Password123!',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.user.role, 'DEVELOPER');
    assert.ok(body.data.accessToken);
    assert.ok(body.data.refreshToken);

    devAccessToken = body.data.accessToken;
    devUserId = body.data.user.id;
  });

  test('POST /auth/login - authenticate seeded admin', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@hookrelay.dev',
        password: 'Password123!',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.user.role, 'ADMIN');
    adminAccessToken = body.data.accessToken;
  });

  test('GET /auth/me - returns user profile with JWT', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${devAccessToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.user.email, 'student@hookrelay.dev');
  });

  test('POST /api-keys - developer creates a new API key', async () => {
    const res = await fetch(`${baseUrl}/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${devAccessToken}`,
      },
      body: JSON.stringify({
        name: 'Stripe Webhooks Ingestion Key',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.apiKey.startsWith('hr_live_'));
    assert.equal(body.data.rateLimit, 60);
  });

  test('POST /endpoints - register a new webhook destination with SSRF validation', async () => {
    // 1. Rejects AWS metadata endpoint
    const badRes = await fetch(`${baseUrl}/endpoints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${devAccessToken}`,
      },
      body: JSON.stringify({
        url: 'http://169.254.169.254/latest/meta-data/',
        description: 'Attack endpoint',
        eventTypes: ['*'],
      }),
    });
    assert.equal(badRes.status, 400);

    // 2. Accepts valid local mock receiver in dev
    const goodRes = await fetch(`${baseUrl}/endpoints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${devAccessToken}`,
      },
      body: JSON.stringify({
        url: 'http://localhost:4001/webhook',
        description: 'Local Mock Endpoint',
        eventTypes: ['order.created'],
      }),
    });
    assert.equal(goodRes.status, 201);
    const body = await goodRes.json();
    assert.ok(body.data.secret.startsWith('whsec_'));
  });

  test('POST /endpoints/:id/resume & pause - circuit breaker manual toggle', async () => {
    // List endpoints to get one
    const listRes = await fetch(`${baseUrl}/endpoints`, {
      headers: { Authorization: `Bearer ${devAccessToken}` },
    });
    const { data: endpoints } = await listRes.json();
    const target = endpoints[0];

    // Pause endpoint
    const pauseRes = await fetch(`${baseUrl}/endpoints/${target.id}/pause`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${devAccessToken}` },
    });
    assert.equal(pauseRes.status, 200);

    // Resume endpoint
    const resumeRes = await fetch(`${baseUrl}/endpoints/${target.id}/resume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${devAccessToken}` },
    });
    assert.equal(resumeRes.status, 200);
    const resumed = await resumeRes.json();
    assert.equal(resumed.data.isPaused, false);
    assert.equal(resumed.data.consecutiveFailures, 0);
  });
});
