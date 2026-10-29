# System Architecture & Design Diagrams (HookRelay)

*Course Alignment: System Design & Software Engineering — Object-Oriented Architecture, Design Patterns, and Asynchronous Flow Control.*

---

## 1. High-Level System Architecture

HookRelay decouples event ingestion from external HTTP dispatching using a durable relational MySQL queue and an in-process worker backed by an in-memory priority queue (`MinHeap`).

```mermaid
graph TD
    Client["Outbound Service / Client"] -->|"POST /v1/events (API Key)"| APIGateway["Express API Gateway"]
    
    subgraph Ingestion Pipeline
        APIGateway --> RateLimiter["TokenBucket Rate Limiter (O(1))"]
        RateLimiter --> ZodValidation["Zod Schema Validator"]
        ZodValidation --> IdempotencyCheck{"Idempotent Key Exists?"}
        IdempotencyCheck -- Yes --> ReturnCached["Return Existing Event (HTTP 200)"]
        IdempotencyCheck -- No --> AtomicTx["ACID Database Transaction"]
        AtomicTx -->|"Insert Event & Deliveries"| MySQL[(MySQL 8 Database)]
    end

    subgraph Background Delivery Worker
        WorkerPoller["Queue Poller Loop (1s)"] -->|"Indexed Query (status, nextAttemptAt)"| MySQL
        WorkerPoller -->|"Enqueue Due Jobs"| MinHeapQueue["Binary MinHeap Priority Queue"]
        MinHeapQueue -->|"Extract Due Earliest (pop)"| Dispatcher["HTTP Dispatcher"]
        Dispatcher -->|"Compute HMAC-SHA256"| Signer["Crypto Signer"]
        Dispatcher -->|"POST with 10s AbortController"| TargetServer["Subscriber Webhook Receiver"]
        TargetServer -->|"2xx Success / 5xx Failure"| Dispatcher
        Dispatcher -->|"Log Attempt"| MySQL
        Dispatcher -->|"Emit Lifecycle Event"| EventBus["Observer Event Bus"]
    end

    subgraph Observability & Protection
        EventBus --> CircuitBreaker["Circuit Breaker (5 Failure Threshold)"]
        CircuitBreaker -->|"Trip (Auto-Pause)"| MySQL
        EventBus --> MetricsEngine["Metrics & Z-Score Anomaly Engine"]
        MetricsEngine --> Dashboard["React + Vite Monitoring Dashboard"]
    end
```

---

## 2. UML Class Diagram (Design Patterns)

HookRelay applies established software engineering design patterns:
1. **Strategy Pattern:** `BackoffStrategy` with pluggable `ExponentialBackoff` and `FixedBackoff` implementations.
2. **Observer Pattern:** Node's `EventEmitter` decouples worker network dispatch from telemetry and circuit breaker updates.
3. **Data Access Object / Repository:** Prisma Client abstraction over normalized MySQL tables.

```mermaid
classDiagram
    class BackoffStrategy {
        <<abstract>>
        +getDelayMs(attemptNumber: int) int*
    }

    class FixedBackoff {
        -delayMs: int
        +getDelayMs(attemptNumber: int) int
    }

    class ExponentialBackoff {
        -baseMs: int
        -factor: int
        -maxDelayMs: int
        -withJitter: boolean
        +getDelayMs(attemptNumber: int) int
    }

    BackoffStrategy <|-- FixedBackoff
    BackoffStrategy <|-- ExponentialBackoff

    class MinHeap {
        -heap: Array
        -comparator: Function
        +push(item: any) void
        +pop() any
        +peek() any
        +size() int
        +isEmpty() boolean
        -_bubbleUp(index: int) void
        -_bubbleDown(index: int) void
        -_swap(i: int, j: int) void
    }

    class TokenBucket {
        -capacity: int
        -refillRatePerSec: float
        -tokens: float
        -lastRefill: timestamp
        +consume(count: int) Object
        +refill() void
    }

    class DeliveryWorker {
        -minHeap: MinHeap
        -backoffStrategy: BackoffStrategy
        -isRunning: boolean
        +start() void
        +stop() void
        +pollDueDeliveries() void
        +dispatch(delivery: Delivery) void
        +handleSuccess(...) void
        +handleFailure(...) void
    }

    class CircuitBreakerService {
        -threshold: int
        +getCircuitSummary(userId, role) Object
        +resume(endpointId) Object
    }

    DeliveryWorker o-- MinHeap : uses
    DeliveryWorker o-- BackoffStrategy : injects
    DeliveryWorker ..> CircuitBreakerService : notifies via eventBus
```

---

## 3. Webhook Delivery & Exponential Retry Sequence Diagram

This sequence diagram illustrates the lifecycle of an event triggering a delivery, encountering a transient failure, retrying with exponential backoff, tripping the circuit breaker, and executing a dead-letter replay:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Ingestion Client
    participant API as Express API
    participant DB as MySQL 8
    participant Worker as Delivery Worker
    participant Heap as MinHeap Priority Queue
    participant Receiver as Subscriber Webhook Target
    participant Bus as Observer EventBus

    Client->>API: POST /v1/events (Body + IdempotencyKey)
    API->>API: TokenBucket Check (Rate Limiter)
    API->>DB: Atomic Transaction: Insert Event + Deliveries (status: PENDING)
    DB-->>API: Transaction Committed
    API-->>Client: HTTP 201 Created (deliveries queued)

    loop Polling Loop (Every 1s)
        Worker->>DB: SELECT * FROM deliveries WHERE status IN ('PENDING', 'FAILED') AND nextAttemptAt <= NOW()
        DB-->>Worker: Due deliveries batch
        Worker->>DB: UPDATE deliveries SET status = 'PROCESSING'
        Worker->>Heap: push(delivery) O(log N)
    end

    Heap-->>Worker: pop() earliest due delivery
    Worker->>Worker: Compute HMAC-SHA256 signature
    Worker->>Receiver: HTTP POST with X-HookRelay-Signature (10s Timeout)
    Receiver-->>Worker: HTTP 500 Internal Server Error (Transient failure)
    
    Worker->>DB: INSERT into delivery_attempts (status: 500, latencyMs)
    Worker->>Worker: ExponentialBackoff.getDelayMs(1) with Jitter
    Worker->>DB: UPDATE deliveries SET status = 'FAILED', nextAttemptAt = NOW() + delay
    Worker->>Bus: emit('delivery.failed')

    Note over Worker,Receiver: Retries repeat up to 6 times...

    Worker->>Receiver: HTTP POST Attempt #6
    Receiver-->>Worker: HTTP 500 Crash
    Worker->>DB: UPDATE deliveries SET status = 'DEAD' (Moved to DLQ)
    Worker->>DB: UPDATE webhook_endpoints SET isPaused = true (Circuit Breaker Tripped)
    Worker->>Bus: emit('delivery.dead'), emit('endpoint.paused')

    Note over Client,API: Operator notices in dashboard and clicks Replay...
    Client->>API: POST /v1/deliveries/:id/replay
    API->>DB: UPDATE deliveries SET status = 'PENDING', retryCount = 0, nextAttemptAt = NOW()
    API-->>Client: HTTP 200 OK (Re-queued)
```

