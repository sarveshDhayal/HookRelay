import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';

const app = express();
const port = parseInt(process.env.PORT || '4001', 10);

app.use(cors());
// Keep raw body for HMAC signature verification
app.use(express.json());

// In-memory log of recent webhook receipts
const receivedHistory = [];
let flakyCounter = 0;

function logWebhook(req, status, extra = '') {
  const item = {
    receivedAt: new Date().toISOString(),
    endpoint: req.originalUrl,
    signature: req.headers['x-hookrelay-signature'] || null,
    timestamp: req.headers['x-hookrelay-timestamp'] || null,
    eventId: req.headers['x-hookrelay-event-id'] || null,
    deliveryId: req.headers['x-hookrelay-delivery-id'] || null,
    body: req.body,
    status,
    extra,
  };
  receivedHistory.unshift(item);
  if (receivedHistory.length > 50) receivedHistory.pop();
  console.log(`[Mock Receiver] ${req.method} ${req.originalUrl} -> ${status} ${extra}`);
}

// 1. Healthy target: Always returns 200 OK
app.post('/webhook', (req, res) => {
  logWebhook(req, 200, 'Success');
  res.status(200).json({
    received: true,
    message: 'Webhook processed successfully',
    eventId: req.headers['x-hookrelay-event-id'],
  });
});

// 2. Flaky target: Fails initially, succeeds on retry
app.post('/flaky', (req, res) => {
  flakyCounter++;
  if (flakyCounter % 2 === 1) {
    logWebhook(req, 503, `Flaky failure #${flakyCounter}`);
    return res.status(503).json({
      error: 'Service temporarily overloaded. Please retry.',
      attempt: flakyCounter,
    });
  }

  logWebhook(req, 200, `Flaky recovered on #${flakyCounter}`);
  res.status(200).json({
    received: true,
    message: 'Processed after transient failure',
    attempt: flakyCounter,
  });
});

// 3. Failing target: Always 500 (triggers retries, DLQ, and circuit breaker)
app.post('/failing', (req, res) => {
  logWebhook(req, 500, 'Permanent failure');
  res.status(500).json({
    error: 'Internal crash simulation',
    timestamp: new Date().toISOString(),
  });
});

// 4. Slow target: Responds after 2-second delay
app.post('/slow', async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  logWebhook(req, 200, 'Delayed response (2000ms)');
  res.status(200).json({
    received: true,
    message: 'Processed after deliberate 2s latency',
  });
});

// 5. Timeout target: Responds after 12 seconds to test 10s worker abort
app.post('/timeout', async (req, res) => {
  console.log('[Mock Receiver] Simulating connection hang (12s)...');
  await new Promise((resolve) => setTimeout(resolve, 12000));
  logWebhook(req, 200, 'Finished hanging');
  res.status(200).json({ received: true });
});

// Inspection endpoints for live demo and tests
app.get('/inspect', (req, res) => {
  res.json({
    totalReceived: receivedHistory.length,
    recent: receivedHistory,
  });
});

app.post('/reset', (req, res) => {
  receivedHistory.length = 0;
  flakyCounter = 0;
  res.json({ success: true, message: 'Mock receiver logs reset' });
});

app.listen(port, () => {
  console.log(`[Mock Receiver] Listening on port ${port}`);
  console.log(`Endpoints available: /webhook (200), /flaky (503/200), /failing (500), /slow, /timeout`);
});
