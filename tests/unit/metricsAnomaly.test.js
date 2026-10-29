import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePercentile,
  computeZScores,
} from '../../src/services/metrics.service.js';

describe('Metrics & Anomaly Detector (Prob & Stats / ML Bonus)', () => {
  test('calculatePercentile accurately finds p50 (median) and p95', () => {
    // Array of 100 values: 1, 2, ..., 100
    const values = Array.from({ length: 100 }, (_, i) => i + 1);

    const p50 = calculatePercentile(values, 50);
    const p95 = calculatePercentile(values, 95);

    assert.equal(p50, 51); // 50th index in 0-indexed array is 51
    assert.equal(p95, 96);
  });

  test('calculatePercentile handles empty or small arrays gracefully', () => {
    assert.equal(calculatePercentile([], 50), 0);
    assert.equal(calculatePercentile([42], 95), 42);
  });

  test('computeZScores identifies statistical outlier endpoint with z > 2', () => {
    // 8 endpoints: 7 healthy with low failure rates (1-3%), 1 anomalous endpoint with 95% failure rate
    const endpoints = [
      { id: 'ep-1', failureRate: 0.02, totalDeliveries: 100, failedDeliveries: 2, isPaused: false },
      { id: 'ep-2', failureRate: 0.01, totalDeliveries: 100, failedDeliveries: 1, isPaused: false },
      { id: 'ep-3', failureRate: 0.03, totalDeliveries: 100, failedDeliveries: 3, isPaused: false },
      { id: 'ep-4', failureRate: 0.02, totalDeliveries: 100, failedDeliveries: 2, isPaused: false },
      { id: 'ep-5', failureRate: 0.01, totalDeliveries: 100, failedDeliveries: 1, isPaused: false },
      { id: 'ep-6', failureRate: 0.02, totalDeliveries: 100, failedDeliveries: 2, isPaused: false },
      { id: 'ep-7', failureRate: 0.03, totalDeliveries: 100, failedDeliveries: 3, isPaused: false },
      { id: 'ep-8', failureRate: 0.95, totalDeliveries: 80, failedDeliveries: 76, isPaused: false },
    ];

    const scored = computeZScores(endpoints);
    const outlier = scored.find((e) => e.id === 'ep-8');
    const normal = scored.find((e) => e.id === 'ep-1');

    assert.ok(outlier.zScore > 2.0, `Outlier Z-score should be > 2.0, got ${outlier.zScore}`);
    assert.equal(outlier.isAnomaly, true);
    assert.equal(outlier.healthStatus, 'ANOMALY');

    assert.ok(normal.zScore < 0.5);
    assert.equal(normal.isAnomaly, false);
    assert.equal(normal.healthStatus, 'HEALTHY');
  });
});
