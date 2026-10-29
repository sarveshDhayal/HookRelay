import { TokenBucket } from '../utils/tokenBucket.js';

// In-memory bucket store: Maps identifier (apiKeyId or userId) -> TokenBucket instance
const bucketStore = new Map();

// Helper to reset bucket store during unit & integration testing
export function clearRateLimitBuckets() {
  bucketStore.clear();
}

// Rate Limiting Middleware using custom TokenBucket algorithm
export function rateLimiter(req, res, next) {
  // Identify the requester: prefer API key ID, fallback to user ID or client IP
  const identifier =
    req.apiKey?.id ||
    req.user?.id ||
    req.ip ||
    req.headers['x-forwarded-for'] ||
    'anonymous';

  // Determine capacity and refill rate based on user plan or API key settings
  let capacity = 60;
  let refillRatePerSec = 1.0; // 60 req/min

  if (req.apiKey?.rateLimit) {
    capacity = req.apiKey.rateLimit;
    refillRatePerSec = capacity / 60.0;
  } else if (req.user?.plan === 'PRO') {
    capacity = 300;
    refillRatePerSec = 5.0; // 300 req/min
  }

  // Retrieve or instantiate bucket
  let bucket = bucketStore.get(identifier);
  if (!bucket) {
    bucket = new TokenBucket({ capacity, refillRatePerSec });
    bucketStore.set(identifier, bucket);
  }

  const result = bucket.consume(1);

  // Set standard rate limit headers (RFC 6585)
  res.setHeader('X-RateLimit-Limit', bucket.capacity);
  res.setHeader('X-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    res.setHeader('Retry-After', result.retryAfter);
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Too many requests, please slow down.',
      retryAfter: result.retryAfter,
    });
  }

  next();
}

