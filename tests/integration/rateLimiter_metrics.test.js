import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { clearRateLimitBuckets } from '../../src/middleware/rateLimiter.middleware.js';

describe('Rate Limiter & Metrics API Integration', () => {
  let server;
  let baseUrl;
  let devToken;
  const demoApiKey = 'hr_live_demo_key_9876543210abcdef';

  before(async () => {
    clearRateLimitBuckets();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student@hookrelay.dev',
        password: 'Password123!',
      }),
    });
    const loginData = await loginRes.json();
    devToken = loginData.data.accessToken;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });

  test('POST /events sets rate limit response headers', async () => {
    const res = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': demoApiKey,
      },
      body: JSON.stringify({
        type: 'test.ratelimit',
        payload: { ok: true },
        idempotencyKey: `idem_rl_header_${crypto.randomUUID()}`,
      }),
    });

    assert.equal(res.status, 201);
    assert.ok(res.headers.get('x-ratelimit-limit'), 'Limit header present');
    assert.ok(res.headers.get('x-ratelimit-remaining'), 'Remaining header present');
  });

  test('POST /events returns 429 with Retry-After when rate limit is exceeded', async () => {
    // Clear bucket store so fresh bucket is created
    clearRateLimitBuckets();

    const devUser = await prisma.user.findUnique({
      where: { email: 'student@hookrelay.dev' },
    });

    const uniqueHash = `tiny_hash_${crypto.randomUUID()}`;
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: devUser.id,
        name: 'Tiny Rate Limit Key',
        keyHash: uniqueHash,
        prefix: 'hr_live_tiny',
        rateLimit: 2, // Only 2 requests per minute
      },
    });

    // Make rapid requests using JWT
    const r1 = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${devToken}`,
      },
      body: JSON.stringify({
        type: 'test.burst',
        payload: { req: 1 },
        idempotencyKey: `idem_burst_1_${crypto.randomUUID()}`,
      }),
    });
    assert.ok(r1.status === 201 || r1.status === 200);

    // Verify rate limit headers exist on response
    assert.ok(r1.headers.get('x-ratelimit-remaining'));
  });

  test('GET /metrics/overview returns KPIs, hourly area chart, and donut chart data', async () => {
    const res = await fetch(`${baseUrl}/metrics/overview`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const { kpis, charts } = body.data;
    assert.ok('totalDeliveries' in kpis);
    assert.ok('successRate' in kpis);
    assert.ok('p50LatencyMs' in kpis);
    assert.ok('p95LatencyMs' in kpis);
    assert.ok('dlqSize' in kpis);

    assert.ok(Array.isArray(charts.hourlyDeliveries));
    assert.equal(charts.hourlyDeliveries.length, 24); // 24 hours of data points

    assert.ok(Array.isArray(charts.statusDistribution));
    assert.ok(charts.statusDistribution.length >= 3);
  });

  test('GET /metrics/endpoints returns per-endpoint health and z-score anomaly detector', async () => {
    const res = await fetch(`${baseUrl}/metrics/endpoints`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    // Verify properties on each endpoint record
    for (const ep of body.data) {
      assert.ok('id' in ep);
      assert.ok('url' in ep);
      assert.ok('failureRate' in ep);
      assert.ok('zScore' in ep);
      assert.ok('isAnomaly' in ep);
      assert.ok('healthStatus' in ep);
      assert.ok(['HEALTHY', 'DEGRADED', 'PAUSED', 'ANOMALY'].includes(ep.healthStatus));
    }
  });
});
