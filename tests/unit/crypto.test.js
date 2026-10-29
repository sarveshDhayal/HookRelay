import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashApiKey,
  generateApiKey,
  generateEndpointSecret,
  computeHmacSignature,
  verifyHmacSignature,
} from '../../src/utils/crypto.js';

describe('Cryptographic Utilities', () => {
  test('generateApiKey outputs expected prefix and length', () => {
    const key = generateApiKey();
    assert.equal(key.startsWith('hr_live_'), true);
    assert.equal(key.length, 8 + 36); // 'hr_live_' + 36 hex chars
  });

  test('generateEndpointSecret outputs expected prefix and length', () => {
    const secret = generateEndpointSecret();
    assert.equal(secret.startsWith('whsec_'), true);
    assert.equal(secret.length, 6 + 36);
  });

  test('hashApiKey produces deterministic SHA-256 hex string', () => {
    const key = 'hr_live_test_key_123';
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
  });

  test('computeHmacSignature and verifyHmacSignature match', () => {
    const secret = 'whsec_sample_secret_key_12345';
    const timestamp = '1700000000';
    const payload = JSON.stringify({ event: 'test', data: 42 });

    const sig = computeHmacSignature(secret, timestamp, payload);
    assert.equal(typeof sig, 'string');
    assert.equal(sig.length, 64);

    const valid = verifyHmacSignature(secret, timestamp, payload, sig);
    assert.equal(valid, true);

    const tampered = verifyHmacSignature(secret, timestamp, payload + ' ', sig);
    assert.equal(tampered, false);
  });
});

