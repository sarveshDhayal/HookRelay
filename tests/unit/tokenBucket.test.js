import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket } from '../../src/utils/tokenBucket.js';

describe('TokenBucket Rate Limiter (DSA & Computer Networks)', () => {
  test('initializes at full capacity', () => {
    const bucket = new TokenBucket({ capacity: 10, refillRatePerSec: 2 });
    assert.equal(bucket.tokens, 10);
    assert.equal(bucket.capacity, 10);
  });

  test('consumes tokens successfully when available', () => {
    const bucket = new TokenBucket({ capacity: 5, refillRatePerSec: 1 });
    const r1 = bucket.consume(1);
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 4);

    const r2 = bucket.consume(2);
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 2);
  });

  test('blocks requests when bucket is exhausted and returns retryAfter', () => {
    const bucket = new TokenBucket({ capacity: 3, refillRatePerSec: 1 });

    // Consume all 3
    bucket.consume(3);

    // 4th request must be rejected
    const blocked = bucket.consume(1);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfter >= 1);
  });

  test('refills tokens over time proportionally to refill rate', async () => {
    const bucket = new TokenBucket({ capacity: 10, refillRatePerSec: 10 }); // 10 tokens per sec
    bucket.consume(10); // Bucket is now empty
    assert.equal(bucket.tokens < 1, true);

    // Wait 250ms (should replenish ~2.5 tokens)
    await new Promise((r) => setTimeout(r, 250));

    bucket.refill();
    assert.ok(bucket.tokens >= 2, `Tokens should be >= 2 after 250ms, got ${bucket.tokens}`);
    assert.ok(bucket.tokens <= 4, `Tokens should be <= 4 after 250ms, got ${bucket.tokens}`);
  });

  test('never exceeds maximum capacity regardless of elapsed time', async () => {
    const bucket = new TokenBucket({ capacity: 5, refillRatePerSec: 100 });
    // Simulate long idle period
    bucket.lastRefill = Date.now() - 100000;
    bucket.refill();
    assert.equal(bucket.tokens, 5);
  });
});

