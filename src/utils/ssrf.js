import dns from 'node:dns/promises';
import { URL } from 'node:url';
import { AppError } from './errors.js';

// Convert an IPv4 address string to a 32-bit integer for CIDR range checks
function ipv4ToInt(ip) {
  return ip
    .split('.')
    .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

// Check if an IPv4 address falls within a given CIDR block
function isIpInCidr(ip, cidr) {
  const [range, bits = 32] = cidr.split('/');
  const mask = bits === 0 ? 0 : (~0 << (32 - parseInt(bits, 10))) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask);
}

// Blocked IP ranges per RFC standards (Computer Networks topic)
const BLOCKED_IPV4_CIDRS = [
  '0.0.0.0/8', // Current network
  '10.0.0.0/8', // RFC 1918 Private
  '100.64.0.0/10', // Shared address space (CGNAT)
  '127.0.0.0/8', // Loopback
  '169.254.0.0/16', // Link-local / AWS metadata service (169.254.169.254)
  '172.16.0.0/12', // RFC 1918 Private
  '192.0.0.0/24', // IETF Protocol Assignments
  '192.0.2.0/24', // TEST-NET-1
  '192.168.0.0/16', // RFC 1918 Private
  '198.18.0.0/15', // Benchmarking
  '198.51.100.0/24', // TEST-NET-2
  '203.0.113.0/24', // TEST-NET-3
  '224.0.0.0/4', // Multicast
  '240.0.0.0/4', // Reserved
  '255.255.255.255/32', // Broadcast
];

// Check if an IP is private, loopback, or link-local
export function isPrivateIp(ipAddress) {
  // IPv6 loopback and private checks
  if (ipAddress === '::1' || ipAddress === '::') return true;
  if (ipAddress.toLowerCase().startsWith('fe80:')) return true; // Link-local
  if (ipAddress.toLowerCase().startsWith('fc') || ipAddress.toLowerCase().startsWith('fd')) return true; // Unique local

  // If it is IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  const ipv4 = ipAddress.startsWith('::ffff:') ? ipAddress.replace('::ffff:', '') : ipAddress;

  for (const cidr of BLOCKED_IPV4_CIDRS) {
    if (isIpInCidr(ipv4, cidr)) {
      return true;
    }
  }

  return false;
}

// Validates a webhook destination URL against SSRF attacks
// 1. Checks protocol (must be http or https)
// 2. Resolves DNS to find all resolved IP addresses
// 3. Verifies no resolved IP belongs to a private, loopback, or metadata range
export async function validateEndpointUrl(urlString, options = { allowLocalDev: false }) {
  let parsedUrl;
  try {
    parsedUrl = new URL(urlString);
  } catch (err) {
    throw new AppError('Invalid URL format', 400);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new AppError('Only HTTP and HTTPS protocols are supported', 400);
  }

  const hostname = parsedUrl.hostname;

  // In development, allow localhost for demo and mock-receiver if explicitly allowed
  if (options.allowLocalDev && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    return true;
  }

  // Resolve hostname via DNS to prevent DNS rebinding or direct IP injection
  try {
    const addresses = await dns.lookup(hostname, { all: true });

    if (!addresses || addresses.length === 0) {
      throw new AppError(`Cannot resolve hostname: ${hostname}`, 400);
    }

    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        throw new AppError(
          `SSRF Protection: Hostname "${hostname}" resolves to blocked private IP (${record.address})`,
          400
        );
      }
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(`DNS lookup failed for hostname "${hostname}": ${err.message}`, 400);
  }

  return true;
}
