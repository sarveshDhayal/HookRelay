// Token Bucket Rate Limiter Algorithm (DSA & Computer Networks Coursework)
//
// Theoretical Model:
// A token bucket has a maximum capacity (burst size) and continuously refills
// at a steady rate of `refillRatePerSec` tokens per second.
// Each request requires 1 token to pass. If the bucket is empty, the request is
// rejected with HTTP 429 and informed when the next token will be available.
//
// Why Lazy Timestamp Refill? (Engineering Optimization)
// Instead of creating background `setInterval` timers for every single active API key
// (which wastes CPU cycles and leaks memory on thousands of keys), we calculate token
// replenishment lazily on-demand whenever a request arrives:
//   tokensToAdd = (now - lastRefill) * refillRatePerSec
//
// Time Complexity:
//   - consume(): O(1) constant time
//   - refill():  O(1) constant time
// Space Complexity: O(1) memory per bucket

export class TokenBucket {
  constructor({ capacity = 60, refillRatePerSec = 1.0 } = {}) {
    this.capacity = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.tokens = capacity; // Start full
    this.lastRefill = Date.now();
  }

  // Refill tokens based on elapsed wall-clock time
  refill() {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;

    if (elapsedSeconds > 0) {
      const tokensToAdd = elapsedSeconds * this.refillRatePerSec;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  // Attempt to consume tokens for a request
  consume(tokensToConsume = 1) {
    this.refill();

    if (this.tokens >= tokensToConsume) {
      this.tokens -= tokensToConsume;
      return {
        allowed: true,
        remaining: Math.floor(this.tokens),
        retryAfter: 0,
      };
    }

    // Bucket exhausted: calculate how many seconds until enough tokens accumulate
    const shortfall = tokensToConsume - this.tokens;
    const retryAfterSeconds = Math.ceil(shortfall / this.refillRatePerSec);

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, retryAfterSeconds),
    };
  }
}

