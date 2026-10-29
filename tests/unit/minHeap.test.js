import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MinHeap } from '../../src/utils/minHeap.js';

describe('MinHeap Priority Queue (DSA Coursework)', () => {
  test('initializes empty and reports correct size', () => {
    const heap = new MinHeap();
    assert.equal(heap.isEmpty(), true);
    assert.equal(heap.size(), 0);
    assert.equal(heap.peek(), null);
    assert.equal(heap.pop(), null);
  });

  test('extracts elements in strictly non-decreasing order (Min-Heap property)', () => {
    const heap = new MinHeap((a, b) => a - b);
    const input = [45, 10, 80, 5, 25, 1, 99, 14];

    for (const val of input) {
      heap.push(val);
    }

    assert.equal(heap.size(), input.length);
    assert.equal(heap.peek(), 1);

    const sortedOutput = [];
    while (!heap.isEmpty()) {
      sortedOutput.push(heap.pop());
    }

    assert.deepEqual(sortedOutput, [1, 5, 10, 14, 25, 45, 80, 99]);
  });

  test('handles date-based priorities for delivery job scheduling', () => {
    const heap = new MinHeap(
      (a, b) => new Date(a.nextAttemptAt).getTime() - new Date(b.nextAttemptAt).getTime()
    );

    const t1 = new Date('2026-10-29T10:00:00Z');
    const t2 = new Date('2026-10-29T10:05:00Z');
    const t3 = new Date('2026-10-29T09:55:00Z');

    heap.push({ id: 'job-1', nextAttemptAt: t1 });
    heap.push({ id: 'job-2', nextAttemptAt: t2 });
    heap.push({ id: 'job-3', nextAttemptAt: t3 });

    assert.equal(heap.pop().id, 'job-3'); // Earliest: 09:55
    assert.equal(heap.pop().id, 'job-1'); // Next: 10:00
    assert.equal(heap.pop().id, 'job-2'); // Latest: 10:05
  });

  test('maintains heap property with large random dataset', () => {
    const heap = new MinHeap((a, b) => a - b);
    const count = 500;
    const numbers = Array.from({ length: count }, () => Math.floor(Math.random() * 10000));

    for (const num of numbers) {
      heap.push(num);
    }

    let previous = -Infinity;
    while (!heap.isEmpty()) {
      const current = heap.pop();
      assert.ok(current >= previous, `Heap invariant violated: ${current} < ${previous}`);
      previous = current;
    }
  });
});
