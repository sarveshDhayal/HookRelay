# Database Entity-Relationship (ER) Diagram

*Third Normal Form (3NF) relational schema for HookRelay.*

```mermaid
erDiagram
    User ||--o{ ApiKey : owns
    User ||--o{ WebhookEndpoint : configures
    User ||--o{ Event : produces
    WebhookEndpoint ||--o{ Delivery : receives
    Event ||--o{ Delivery : fans_out_to
    Delivery ||--o{ DeliveryAttempt : logs

    User {
        string id PK "UUID"
        string email UK "Unique email address"
        string passwordHash "Bcrypt hash with salt rounds 10"
        string role "ADMIN or DEVELOPER"
        string plan "FREE (60/min) or PRO (300/min)"
        datetime createdAt
        datetime updatedAt
    }

    ApiKey {
        string id PK "UUID"
        string userId FK "Foreign Key to User"
        string name "Key identifier"
        string keyHash UK "SHA-256 hash of plaintext key"
        string prefix "hr_live_... prefix for display"
        int rateLimit "TokenBucket capacity per minute"
        datetime lastUsedAt
        datetime expiresAt
        datetime revokedAt
        datetime createdAt
    }

    WebhookEndpoint {
        string id PK "UUID"
        string userId FK "Foreign Key to User"
        string url "Target URL (SSRF validated)"
        string description "Optional endpoint notes"
        string secret "HMAC-SHA256 shared secret (whsec_...)"
        json eventTypes "JSON Array of subscribed topics e.g. ['order.*']"
        boolean isActive "Active flag"
        boolean isPaused "Circuit breaker auto-pause flag"
        int consecutiveFailures "Circuit breaker consecutive error count"
        datetime createdAt
        datetime updatedAt
    }

    Event {
        string id PK "UUID"
        string userId FK "Event publisher"
        string type "Event type string e.g. payment.succeeded"
        json payload "Arbitrary event JSON payload"
        string idempotencyKey UK "Unique deduplication constraint"
        datetime createdAt
    }

    Delivery {
        string id PK "UUID"
        string eventId FK "Foreign Key to Event"
        string endpointId FK "Foreign Key to WebhookEndpoint"
        string status "PENDING, PROCESSING, COMPLETED, FAILED, DEAD"
        int retryCount "Number of attempts executed"
        int maxAttempts "Maximum retries before DLQ (default: 6)"
        datetime nextAttemptAt "Composite index with status"
        datetime completedAt "Completion timestamp"
        datetime createdAt
        datetime updatedAt
    }

    DeliveryAttempt {
        string id PK "UUID"
        string deliveryId FK "Foreign Key to Delivery"
        int attemptNumber "Attempt sequence (1-6)"
        int statusCode "HTTP response status code"
        text responseBody "Truncated HTTP response snippet"
        text error "Network error or timeout message"
        int latencyMs "Round-trip network latency in milliseconds"
        datetime attemptedAt "Attempt timestamp"
    }
```

---

## Relational Constraints & Foreign Keys
1. **`User` $\to$ `ApiKey`:** `ON DELETE CASCADE`. When a user account is deleted, all their associated API keys are invalidated immediately.
2. **`User` $\to$ `WebhookEndpoint`:** `ON DELETE CASCADE`. Removing an account purges its registered endpoints.
3. **`Event` $\to$ `Delivery`:** `ON DELETE CASCADE`.
4. **`WebhookEndpoint` $\to$ `Delivery`:** `ON DELETE CASCADE`.
5. **`Delivery` $\to$ `DeliveryAttempt`:** `ON DELETE CASCADE`. An attempt cannot exist without its parent delivery job.

