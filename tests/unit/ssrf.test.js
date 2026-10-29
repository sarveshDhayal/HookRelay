import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, validateEndpointUrl } from '../../src/utils/ssrf.js';

describe('SSRF Protection Utilities', () => {
  test('correctly identifies private IPv4 ranges (RFC 1918)', () => {
    assert.equal(isPrivateIp('10.0.0.1'), true);
    assert.equal(isPrivateIp('10.254.254.254'), true);
    assert.equal(isPrivateIp('172.16.0.1'), true);
    assert.equal(isPrivateIp('172.31.255.255'), true);
    assert.equal(isPrivateIp('192.168.1.1'), true);
    assert.equal(isPrivateIp('192.168.0.254'), true);
  });

  test('blocks loopback and link-local (AWS metadata) addresses', () => {
    assert.equal(isPrivateIp('127.0.0.1'), true);
    assert.equal(isPrivateIp('127.0.0.2'), true);
    assert.equal(isPrivateIp('169.254.169.254'), true); // Cloud metadata IP
    assert.equal(isPrivateIp('169.254.1.1'), true);
  });

  test('blocks IPv6 loopback and private addresses', () => {
    assert.equal(isPrivateIp('::1'), true);
    assert.equal(isPrivateIp('fe80::1'), true);
    assert.equal(isPrivateIp('fc00::1'), true);
  });

  test('allows legitimate public IP addresses', () => {
    assert.equal(isPrivateIp('8.8.8.8'), false);
    assert.equal(isPrivateIp('1.1.1.1'), false);
    assert.equal(isPrivateIp('93.184.216.34'), false); // example.com
  });

  test('validateEndpointUrl rejects non-HTTP/HTTPS URLs', async () => {
    await assert.rejects(
      () => validateEndpointUrl('ftp://example.com/webhook'),
      /Only HTTP and HTTPS/
    );
    await assert.rejects(
      () => validateEndpointUrl('file:///etc/passwd'),
      /Only HTTP and HTTPS/
    );
  });

  test('validateEndpointUrl blocks metadata IP directly', async () => {
    await assert.rejects(
      () => validateEndpointUrl('http://169.254.169.254/latest/meta-data/'),
      /SSRF Protection/
    );
  });
});

