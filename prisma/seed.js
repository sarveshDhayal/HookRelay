import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function main() {
  console.log('[Seed] Clearing existing records for clean state...');
  await prisma.deliveryAttempt.deleteMany({});
  await prisma.delivery.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.webhookEndpoint.deleteMany({});
  await prisma.apiKey.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('[Seed] Creating demo users...');
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@hookrelay.dev',
      passwordHash,
      role: 'ADMIN',
      plan: 'PRO',
    },
  });

  const developer = await prisma.user.create({
    data: {
      email: 'student@hookrelay.dev',
      passwordHash,
      role: 'DEVELOPER',
      plan: 'FREE',
    },
  });

  console.log('[Seed] Creating API keys for developer...');
  const rawKey = 'hr_live_demo_key_9876543210abcdef';
  await prisma.apiKey.create({
    data: {
      userId: developer.id,
      name: 'Development CLI & Testing',
      keyHash: sha256(rawKey),
      prefix: 'hr_live_demo',
      rateLimit: 60,
    },
  });

  console.log('[Seed] Creating webhook endpoints...');
  const ep1 = await prisma.webhookEndpoint.create({
    data: {
      userId: developer.id,
      url: 'http://localhost:4001/webhook',
      description: 'Primary Mock Receiver (Payments & Orders)',
      secret: 'whsec_primary_mock_secret_abcdef123',
      eventTypes: ['payment.succeeded', 'order.created'],
      isActive: true,
      isPaused: false,
      consecutiveFailures: 0,
    },
  });

  const ep2 = await prisma.webhookEndpoint.create({
    data: {
      userId: developer.id,
      url: 'http://localhost:4001/flaky',
      description: 'Flaky QA Webhook (Simulates 500s occasionally)',
      secret: 'whsec_flaky_mock_secret_99887766',
      eventTypes: ['invoice.generated'],
      isActive: true,
      isPaused: false,
      consecutiveFailures: 2,
    },
  });

  const ep3 = await prisma.webhookEndpoint.create({
    data: {
      userId: developer.id,
      url: 'http://localhost:4001/failing',
      description: 'Dead Endpoint (Circuit Breaker Tripped)',
      secret: 'whsec_dead_endpoint_secret_000000',
      eventTypes: ['alert.critical'],
      isActive: true,
      isPaused: true, // Paused by circuit breaker
      consecutiveFailures: 5,
    },
  });

  console.log('[Seed] Creating sample events & deliveries for initial dashboard data...');
  
  // 1. Successful event & delivery
  const event1 = await prisma.event.create({
    data: {
      userId: developer.id,
      type: 'payment.succeeded',
      payload: {
        paymentId: 'pay_123456789',
        amount: 4999,
        currency: 'USD',
        customer: 'alice@example.com',
      },
      idempotencyKey: 'idem_seed_payment_001',
    },
  });

  const delivery1 = await prisma.delivery.create({
    data: {
      eventId: event1.id,
      endpointId: ep1.id,
      status: 'COMPLETED',
      retryCount: 0,
      maxAttempts: 6,
      completedAt: new Date(Date.now() - 3600 * 1000),
    },
  });

  await prisma.deliveryAttempt.create({
    data: {
      deliveryId: delivery1.id,
      attemptNumber: 1,
      statusCode: 200,
      responseBody: '{"received": true, "status": "ok"}',
      latencyMs: 42,
      attemptedAt: new Date(Date.now() - 3600 * 1000),
    },
  });

  // 2. Retried event & delivery (recovered after 1 retry)
  const event2 = await prisma.event.create({
    data: {
      userId: developer.id,
      type: 'order.created',
      payload: {
        orderId: 'ord_987654',
        items: [{ sku: 'LAPTOP-PRO', qty: 1 }],
      },
      idempotencyKey: 'idem_seed_order_002',
    },
  });

  const delivery2 = await prisma.delivery.create({
    data: {
      eventId: event2.id,
      endpointId: ep1.id,
      status: 'COMPLETED',
      retryCount: 1,
      maxAttempts: 6,
      completedAt: new Date(Date.now() - 1800 * 1000),
    },
  });

  await prisma.deliveryAttempt.createMany({
    data: [
      {
        deliveryId: delivery2.id,
        attemptNumber: 1,
        statusCode: 503,
        error: 'HTTP 503 Service Unavailable',
        latencyMs: 110,
        attemptedAt: new Date(Date.now() - 1810 * 1000),
      },
      {
        deliveryId: delivery2.id,
        attemptNumber: 2,
        statusCode: 200,
        responseBody: '{"received": true, "status": "processed"}',
        latencyMs: 48,
        attemptedAt: new Date(Date.now() - 1800 * 1000),
      },
    ],
  });

  // 3. Dead letter delivery (exhausted 6 attempts)
  const event3 = await prisma.event.create({
    data: {
      userId: developer.id,
      type: 'alert.critical',
      payload: {
        server: 'prod-eu-west-1',
        metric: 'cpu_load',
        value: 99.8,
      },
      idempotencyKey: 'idem_seed_alert_003',
    },
  });

  const deadDelivery = await prisma.delivery.create({
    data: {
      eventId: event3.id,
      endpointId: ep3.id,
      status: 'DEAD',
      retryCount: 6,
      maxAttempts: 6,
      completedAt: null,
      nextAttemptAt: new Date(Date.now() - 600 * 1000),
    },
  });

  const attemptsData = [];
  for (let i = 1; i <= 6; i++) {
    attemptsData.push({
      deliveryId: deadDelivery.id,
      attemptNumber: i,
      statusCode: 500,
      error: 'HTTP 500 Internal Server Error (Mock crash simulation)',
      latencyMs: 95 + i * 10,
      attemptedAt: new Date(Date.now() - (7 - i) * 120 * 1000),
    });
  }
  await prisma.deliveryAttempt.createMany({ data: attemptsData });

  console.log('[Seed] Database successfully seeded!');
  console.log('--- Demo Credentials ---');
  console.log('Developer: student@hookrelay.dev / Password123!');
  console.log('Admin:     admin@hookrelay.dev / Password123!');
  console.log('API Key:   ' + rawKey);
}

main()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
