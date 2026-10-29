import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { matchesEventType } from '../../src/services/event.service.js';

describe('Event Pattern Matching', () => {
  test('wildcard "*" matches any event type', () => {
    assert.equal(matchesEventType(['*'], 'order.created'), true);
    assert.equal(matchesEventType(['*'], 'payment.succeeded'), true);
    assert.equal(matchesEventType(['*'], 'random.event.here'), true);
  });

  test('exact match works correctly', () => {
    assert.equal(matchesEventType(['order.created'], 'order.created'), true);
    assert.equal(matchesEventType(['order.created'], 'order.updated'), false);
    assert.equal(matchesEventType(['order.created'], 'payment.succeeded'), false);
  });

  test('prefix wildcard pattern (e.g. "payment.*") matches sub-events', () => {
    assert.equal(matchesEventType(['payment.*'], 'payment.succeeded'), true);
    assert.equal(matchesEventType(['payment.*'], 'payment.failed'), true);
    assert.equal(matchesEventType(['payment.*'], 'order.created'), false);
  });

  test('multiple patterns in subscription array match appropriately', () => {
    const subs = ['order.created', 'payment.*', 'customer.deleted'];
    assert.equal(matchesEventType(subs, 'order.created'), true);
    assert.equal(matchesEventType(subs, 'payment.refunded'), true);
    assert.equal(matchesEventType(subs, 'customer.deleted'), true);
    assert.equal(matchesEventType(subs, 'customer.created'), false);
  });
});

