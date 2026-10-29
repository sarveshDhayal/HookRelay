import autocannon from 'autocannon';
import crypto from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';

async function runBenchmarks() {
  console.log('====================================================');
  console.log('       HookRelay — Performance Benchmark Suite      ');
  console.log('====================================================\n');

  // Start internal test server on dynamic port
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const apiKey = 'hr_live_demo_key_9876543210abcdef';

  console.log(`[Benchmark] Test server listening on ${baseUrl}`);
  console.log('[Benchmark] Testing Event Ingestion Pipeline (POST /v1/events)...');

  // Benchmark 1: Event Ingestion (with rate limiter set to high or testing capacity)
  const ingestionResult = await autocannon({
    url: `${baseUrl}/v1/events`,
    connections: 10,
    pipelining: 1,
    duration: 5,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    setupClient: (client) => {
      client.setBody(
        JSON.stringify({
          type: 'benchmark.load',
          payload: { timestamp: Date.now(), data: 'load-test-payload' },
          idempotencyKey: `bench_${crypto.randomUUID()}`,
        })
      );
    },
  });

  console.log('\n--- 1. Event Ingestion Benchmark Results ---');
  console.log(`Requests/sec:  ${ingestionResult.requests.average}`);
  console.log(`Throughput:    ${(ingestionResult.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
  console.log(`Latency (p50): ${ingestionResult.latency.p50} ms`);
  console.log(`Latency (p90): ${ingestionResult.latency.p90} ms`);
  console.log(`Latency (p99): ${ingestionResult.latency.p99} ms`);
  console.log(`Total 2xx:     ${ingestionResult['2xx']}`);
  console.log(`Total 429:     ${ingestionResult['4xx']}`);

  console.log('\n[Benchmark] Testing System Metrics Aggregations (GET /health)...');

  // Benchmark 2: Lightweight / Health Endpoint
  const healthResult = await autocannon({
    url: `${baseUrl}/health`,
    connections: 15,
    pipelining: 1,
    duration: 5,
  });

  console.log('\n--- 2. Health & Gateway Routing Benchmark Results ---');
  console.log(`Requests/sec:  ${healthResult.requests.average}`);
  console.log(`Throughput:    ${(healthResult.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
  console.log(`Latency (p50): ${healthResult.latency.p50} ms`);
  console.log(`Latency (p90): ${healthResult.latency.p90} ms`);
  console.log(`Latency (p99): ${healthResult.latency.p99} ms`);

  // Cleanup
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();

  console.log('\n====================================================');
  console.log('Benchmark execution completed successfully.');
  console.log('====================================================');

  return {
    ingestion: ingestionResult,
    health: healthResult,
  };
}

runBenchmarks().catch((err) => {
  console.error('[Benchmark Error]', err);
  process.exit(1);
});
