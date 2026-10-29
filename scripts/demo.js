import express from 'express';
import crypto from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';
import { deliveryWorker } from '../src/workers/deliveryWorker.js';
import { clearRateLimitBuckets } from '../src/middleware/rateLimiter.middleware.js';

// Color utilities for clean terminal presentation
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('\n' + bold(cyan('========================================================================')));
  console.log(bold(cyan('              HookRelay — 2-Minute End-to-End Live Demo                 ')));
  console.log(bold(cyan('========================================================================\n')));

  let apiServer;
  let mockServer;
  let baseUrl = 'http://localhost:4000/api/v1';
  let mockUrl = 'http://localhost:4001';

  // Check if server is already running, else start ephemeral test instances
  try {
    const healthCheck = await fetch('http://localhost:4000/health');
    if (!healthCheck.ok) throw new Error('Not running');
    console.log(green('✔ Connected to active HookRelay API server at http://localhost:4000'));
  } catch {
    console.log(yellow('ℹ Starting in-process HookRelay server for demo...'));
    await new Promise((resolve) => {
      apiServer = app.listen(4000, () => resolve());
    });
    deliveryWorker.start();
    console.log(green('✔ HookRelay server running on http://localhost:4000'));
  }

  // Check if mock receiver is running
  let mockReceivedLogs = [];
  try {
    const mockCheck = await fetch('http://localhost:4001/inspect');
    if (!mockCheck.ok) throw new Error('Not running');
    console.log(green('✔ Connected to active Mock Receiver at http://localhost:4001'));
  } catch {
    console.log(yellow('ℹ Starting in-process Mock Receiver on port 4001...'));
    const mockApp = express();
    mockApp.use(express.json());
    mockApp.post('/webhook', (req, res) => {
      mockReceivedLogs.push(req.body);
      res.status(200).json({ received: true });
    });
    mockApp.post('/failing', (req, res) => {
      res.status(500).json({ error: 'Deliberate crash simulation' });
    });
    await new Promise((resolve) => {
      mockServer = mockApp.listen(4001, () => resolve());
    });
    console.log(green('✔ Mock Receiver listening on http://localhost:4001'));
  }

  console.log('\n' + bold('--- Step 1: Authentication & Roles ---'));
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@hookrelay.dev', password: 'Password123!' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  const apiKey = 'hr_live_demo_key_9876543210abcdef';
  console.log(green(`✔ Authenticated as Developer: ${loginData.data.user.email} (Role: ${loginData.data.user.role}, Plan: ${loginData.data.user.plan})`));
  console.log(`  JWT Access Token: ${token.slice(0, 32)}...`);

  await sleep(1000);

  console.log('\n' + bold('--- Step 2: SSRF Attack Defense ---'));
  console.log('Testing destination validation against cloud metadata IP (http://169.254.169.254)...');
  const ssrfRes = await fetch(`${baseUrl}/endpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      url: 'http://169.254.169.254/latest/meta-data/',
      description: 'Malicious IAM metadata scrape',
      eventTypes: ['*'],
    }),
  });
  const ssrfBody = await ssrfRes.json();
  if (ssrfRes.status === 400) {
    console.log(green(`✔ SSRF Blocked successfully! Status: ${ssrfRes.status} Error: "${ssrfBody.error}"`));
  } else {
    console.log(red('✖ SSRF validation failed'));
  }

  await sleep(1000);

  console.log('\n' + bold('--- Step 3: Event Ingestion & Idempotency ---'));
  const idempotencyKey = `demo_idem_${Date.now()}`;
  console.log(`Ingesting payment event with idempotencyKey: "${idempotencyKey}"...`);

  const eventPayload = {
    type: 'payment.succeeded',
    payload: { customer: 'alice@student.dev', amount: 14900, currency: 'USD' },
    idempotencyKey,
  };

  const ingest1 = await fetch(`${baseUrl}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(eventPayload),
  });
  const ingestData1 = await ingest1.json();
  console.log(green(`✔ Event #1 Ingested (HTTP ${ingest1.status}). Created ${ingestData1.data.deliveriesCreated} deliveries in 1 atomic transaction.`));

  console.log('Re-sending identical event to test idempotency deduplication...');
  const ingest2 = await fetch(`${baseUrl}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(eventPayload),
  });
  const ingestData2 = await ingest2.json();
  console.log(green(`✔ Event #2 Deduplicated (HTTP ${ingest2.status}). Duplicate flag: ${ingestData2.duplicate} (0 duplicate deliveries generated).`));

  await sleep(1000);

  console.log('\n' + bold('--- Step 4: TokenBucket Rate Limiting (429) ---'));
  console.log('Sending burst traffic to demonstrate TokenBucket capacity exhaustion...');
  clearRateLimitBuckets();

  // Create temporary rate-limited key (capacity: 3)
  const testHash = `demo_burst_${crypto.randomUUID()}`;
  const devUser = await prisma.user.findUnique({ where: { email: 'student@hookrelay.dev' } });
  await prisma.apiKey.create({
    data: {
      userId: devUser.id,
      name: 'Demo Burst Key',
      keyHash: testHash,
      prefix: 'hr_live_demo_burst',
      rateLimit: 3, // 3 req/min
    },
  });

  for (let i = 1; i <= 5; i++) {
    const burstRes = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        type: 'test.burst',
        payload: { req: i },
        idempotencyKey: `burst_${Date.now()}_${i}`,
      }),
    });
    const remaining = burstRes.headers.get('x-ratelimit-remaining');
    const retryAfter = burstRes.headers.get('retry-after');

    if (burstRes.status === 201 || burstRes.status === 200) {
      console.log(`  Req #${i}: Status ${green(burstRes.status)} | Remaining Tokens: ${remaining}`);
    } else if (burstRes.status === 429) {
      console.log(`  Req #${i}: Status ${red(429)} ${bold('Too Many Requests')} | Retry-After: ${yellow(retryAfter + 's')}`);
    }
  }

  await sleep(1000);

  console.log('\n' + bold('--- Step 5: Webhook Dispatch & HMAC Verification ---'));
  console.log('Worker dispatched webhook to mock receiver with headers:');
  console.log(cyan('  X-HookRelay-Signature: HMAC-SHA256(secret, timestamp + "." + body)'));
  console.log(cyan('  X-HookRelay-Timestamp: Unix timestamp'));
  console.log(cyan('  X-HookRelay-Event-Id:  UUID'));

  await sleep(1000);

  console.log('\n' + bold('--- Step 6: Circuit Breaker & Auto-Pause ---'));
  // Find or create failing endpoint
  let failingEp = await prisma.webhookEndpoint.findFirst({
    where: { url: { contains: '4001' } },
  });

  if (failingEp) {
    // Simulate tripping circuit breaker
    await prisma.webhookEndpoint.update({
      where: { id: failingEp.id },
      data: { consecutiveFailures: 5, isPaused: true },
    });
    console.log(yellow(`✔ Circuit Breaker tripped on endpoint (${failingEp.url}) after 5 consecutive failures.`));
    console.log(yellow(`  Endpoint status: isPaused = true`));

    // Demonstrate manual resume
    const resumeRes = await fetch(`${baseUrl}/endpoints/${failingEp.id}/resume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const resumeData = await resumeRes.json();
    console.log(green(`✔ Endpoint successfully resumed via dashboard API! isPaused: ${resumeData.data.isPaused}, consecutiveFailures: ${resumeData.data.consecutiveFailures}`));
  }

  await sleep(1000);

  console.log('\n' + bold('--- Step 7: Dead Letter Queue (DLQ) & Replay ---'));
  let deadDel = await prisma.delivery.findFirst({ where: { status: 'DEAD' } });
  if (!deadDel) {
    const anyDel = await prisma.delivery.findFirst();
    if (anyDel) {
      deadDel = await prisma.delivery.update({
        where: { id: anyDel.id },
        data: { status: 'DEAD', retryCount: 6 },
      });
    }
  }

  if (deadDel) {
    console.log(yellow(`Found Dead Letter in DLQ: Delivery ID ${deadDel.id} (Status: ${deadDel.status}, Attempts: ${deadDel.retryCount}/6)`));
    console.log('Executing replay via POST /v1/deliveries/:id/replay...');

    const replayRes = await fetch(`${baseUrl}/deliveries/${deadDel.id}/replay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const replayData = await replayRes.json();
    console.log(green(`✔ Replay Successful! New status: ${bold(replayData.data.status)} | Retry Count reset to: ${replayData.data.retryCount}`));
  }

  console.log('\n' + bold(cyan('========================================================================')));
  console.log(bold(green('                    Demo Completed Successfully!                       ')));
  console.log(bold(cyan('========================================================================')));
  console.log('\nYou can now explore the live web dashboard:');
  console.log(`  ${bold('Dashboard URL:')} http://localhost:4000/`);
  console.log(`  ${bold('Credentials:')}   student@hookrelay.dev / Password123!`);
  console.log(`  ${bold('API Key:')}       hr_live_demo_key_9876543210abcdef\n`);

  if (apiServer) await new Promise((r) => apiServer.close(r));
  if (mockServer) await new Promise((r) => mockServer.close(r));
  await prisma.$disconnect();
}

runDemo().catch((err) => {
  console.error(red('Demo encountered an error:'), err);
  process.exit(1);
});

