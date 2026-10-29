import crypto from 'node:crypto';

// Hash an API key with SHA-256 before saving to MySQL
export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Generate a random user-facing API key: hr_live_ + 24 hex characters
export function generateApiKey() {
  const randomBytes = crypto.randomBytes(18).toString('hex');
  return `hr_live_${randomBytes}`;
}

// Generate a signing secret for webhook verification: whsec_ + 24 hex characters
export function generateEndpointSecret() {
  const randomBytes = crypto.randomBytes(18).toString('hex');
  return `whsec_${randomBytes}`;
}

// Computes HMAC-SHA256 signature: HMAC(secret, timestamp + "." + body)
// Follows Stripe-style webhook signature standard taught in web security
export function computeHmacSignature(secret, timestamp, payloadString) {
  const content = `${timestamp}.${payloadString}`;
  return crypto.createHmac('sha256', secret).update(content).digest('hex');
}

// Verify an incoming signature using timing-safe comparison to prevent timing attacks
export function verifyHmacSignature(secret, timestamp, payloadString, expectedSignature) {
  const actualSignature = computeHmacSignature(secret, timestamp, payloadString);
  const actualBuffer = Buffer.from(actualSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

