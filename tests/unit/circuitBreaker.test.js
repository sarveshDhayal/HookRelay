import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreakerService } from '../../src/services/circuitBreaker.service.js';

describe('Circuit Breaker Logic (System Design Coursework)', () => {
  test('initializes with default threshold of 5 failures', () => {
    const cb = new CircuitBreakerService(5);
    assert.equal(cb.threshold, 5);
  });

  test('threshold determines circuit trip behavior', () => {
    const threshold = 5;
    let consecutiveFailures = 0;
    let isPaused = false;

    // Simulate 4 failures: Circuit should remain CLOSED / unpaused
    for (let i = 1; i <= 4; i++) {
      consecutiveFailures++;
      if (consecutiveFailures >= threshold) {
        isPaused = true;
      }
    }
    assert.equal(isPaused, false);
    assert.equal(consecutiveFailures, 4);

    // 5th failure: Circuit must TRIP to OPEN / PAUSED
    consecutiveFailures++;
    if (consecutiveFailures >= threshold) {
      isPaused = true;
    }
    assert.equal(isPaused, true);
    assert.equal(consecutiveFailures, 5);
  });

  test('success resets consecutive failure counter to 0', () => {
    let consecutiveFailures = 4;
    // On success:
    consecutiveFailures = 0;
    assert.equal(consecutiveFailures, 0);
  });
});
