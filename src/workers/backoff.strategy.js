// Strategy Pattern for Retry Backoff (Software Engineering & DAA Coursework)
//
// Mathematical Model:
// Exponential growth can be expressed as a geometric sequence:
//   T(n) = base * (factor^n)
// Total wait time after k attempts is the sum of a geometric series:
//   S_k = \sum_{i=1}^k base * 2^{i-1} = base * (2^k - 1)
//
// Why Jitter? (Full Jitter Strategy from AWS Architecture / Queuing Theory)
// Without jitter, if a downstream server goes down and recovers, hundreds of
// webhook retries scheduled at the exact same base * 2^n mark will strike
// simultaneously, causing a "Thundering Herd" and crashing the server again.
// Jitter spreads the retry distribution uniformly across [0, T(n)].

export class BackoffStrategy {
  getDelayMs(attemptNumber) {
    throw new Error('getDelayMs must be implemented by subclass');
  }
}

// 1. Fixed Backoff Strategy (useful for deterministic tests and simple targets)
export class FixedBackoff extends BackoffStrategy {
  constructor(delayMs = 5000) {
    super();
    this.delayMs = delayMs;
  }

  getDelayMs() {
    return this.delayMs;
  }
}

// 2. Exponential Backoff with Jitter Strategy (Industry standard)
export class ExponentialBackoff extends BackoffStrategy {
  constructor({
    baseMs = 5000, // 5 seconds base
    factor = 2, // Double each retry
    maxDelayMs = 300000, // 5 minutes max cap
    withJitter = true,
  } = {}) {
    super();
    this.baseMs = baseMs;
    this.factor = factor;
    this.maxDelayMs = maxDelayMs;
    this.withJitter = withJitter;
  }

  getDelayMs(attemptNumber) {
    // attemptNumber is 1-indexed (1st retry, 2nd retry, etc.)
    const attempt = Math.max(1, attemptNumber);

    // Calculate deterministic exponential delay: base * factor^(attempt - 1)
    const rawDelay = this.baseMs * Math.pow(this.factor, attempt - 1);
    const cappedDelay = Math.min(rawDelay, this.maxDelayMs);

    if (!this.withJitter) {
      return Math.round(cappedDelay);
    }

    // Full Jitter: Uniform random distribution in [baseMs, cappedDelay]
    // Ensures retries never fire in 0ms while preventing herd synchronization
    const minDelay = Math.min(this.baseMs, cappedDelay);
    const jittered = minDelay + Math.random() * (cappedDelay - minDelay);

    return Math.round(jittered);
  }
}

