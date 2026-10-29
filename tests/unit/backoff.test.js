import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FixedBackoff,
  ExponentialBackoff,
} from '../../src/workers/backoff.strategy.js';

describe('Retry Backoff Strategies (System Design / DAA)', () => {
  test('FixedBackoff always returns the specified constant delay', () => {
    const fixed = new FixedBackoff(3000);
    assert.equal(fixed.getDelayMs(1), 3000);
    assert.equal(fixed.getDelayMs(5), 3000);
    assert.equal(fixed.getDelayMs(10), 3000);
  });

  test('ExponentialBackoff without jitter follows exact geometric progression', () => {
    const exp = new ExponentialBackoff({
      baseMs: 1000,
      factor: 2,
      maxDelayMs: 60000,
      withJitter: false,
    });

    // T(n) = 1000 * 2^(n-1)
    assert.equal(exp.getDelayMs(1), 1000);  // 1000 * 2^0
    assert.equal(exp.getDelayMs(2), 2000);  // 1000 * 2^1
    assert.equal(exp.getDelayMs(3), 4000);  // 1000 * 2^2
    assert.equal(exp.getDelayMs(4), 8000);  // 1000 * 2^3
    assert.equal(exp.getDelayMs(5), 16000); // 1000 * 2^4
  });

  test('ExponentialBackoff caps growth at maxDelayMs', () => {
    const exp = new ExponentialBackoff({
      baseMs: 1000,
      factor: 2,
      maxDelayMs: 5000,
      withJitter: false,
    });

    assert.equal(exp.getDelayMs(1), 1000);
    assert.equal(exp.getDelayMs(3), 4000);
    assert.equal(exp.getDelayMs(4), 5000); // Capped at 5000
    assert.equal(exp.getDelayMs(10), 5000);
  });

  test('ExponentialBackoff with jitter stays within valid bounds', () => {
    const exp = new ExponentialBackoff({
      baseMs: 1000,
      factor: 2,
      maxDelayMs: 8000,
      withJitter: true,
    });

    for (let attempt = 1; attempt <= 5; attempt++) {
      const delay = exp.getDelayMs(attempt);
      assert.ok(delay >= 1000, `Delay ${delay} should be at least baseMs (1000)`);
      assert.ok(delay <= 8000, `Delay ${delay} should be <= maxDelayMs (8000)`);
    }
  });
});

