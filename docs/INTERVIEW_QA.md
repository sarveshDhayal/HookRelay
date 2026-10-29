# 20 University & Placement Interview Questions & Answers

*Targeted technical questions on HookRelay covering DSA, DBMS, Computer Networks, System Design, and Web Architecture.*

---

### 1. Data Structures: Why did you build your own MinHeap instead of using a built-in array or list?
> **Answer:** In JavaScript, `Array.prototype.sort()` takes $\mathcal{O}(N \log N)$ time. Calling `.sort()` every time new retry jobs arrive degrades performance as the queue grows. A binary Min-Heap allows me to insert retry jobs in $\mathcal{O}(\log N)$ time and immediately inspect the earliest due job in $\mathcal{O}(1)$ time. An array-backed complete binary tree also eliminates pointer overhead and maximizes CPU cache locality.

### 2. DAA: What is the time complexity of each MinHeap operation in your codebase?
> **Answer:**
> - `peek()`: $\mathcal{O}(1)$ (root at index 0).
> - `push()`: $\mathcal{O}(\log N)$ (appends to array and bubbles up at most tree height $h = \lfloor\log_2 N\rfloor$).
> - `pop()`: $\mathcal{O}(\log N)$ (moves last element to root and bubbles down).
> - Space complexity: $\mathcal{O}(N)$ contiguous array storage.

### 3. Rate Limiting: How does your Token Bucket implementation work without background timer threads?
> **Answer:** I used a **lazy timestamp replenishment** technique. Instead of running a `setInterval` timer every second for every API key (which wastes CPU and leaks memory), I record `lastRefill` timestamp. When a request arrives, I compute elapsed time $\Delta t = \text{now} - \text{lastRefill}$ and lazily add $\Delta t \times \text{refillRate}$ tokens up to bucket capacity. It runs in $\mathcal{O}(1)$ time and $\mathcal{O}(1)$ memory with zero idle overhead.

### 4. Distributed Systems: Why did you implement "Full Jitter" in your exponential backoff strategy?
> **Answer:** Pure exponential backoff is deterministic: if 500 requests fail simultaneously during a target server outage, all 500 will retry at the exact same second ($T = \text{base} \cdot 2^n$), creating a "Thundering Herd" that crashes the recovering server again. Full Jitter picks a uniform random value between $\text{base}$ and the calculated exponential ceiling, spreading the retries evenly across time and smoothing peak traffic.

### 5. DBMS: How does your database schema satisfy Third Normal Form (3NF)?
> **Answer:**
> - **1NF:** All fields store atomic values, and each record has a unique UUID primary key.
> - **2NF:** All non-key attributes depend fully on the primary key (no partial dependencies).
> - **3NF:** No non-key attribute depends transitively on another non-key attribute. For example, delivery attempt statistics belong strictly in `DeliveryAttempt` with a foreign key to `Delivery`, rather than being stored redundantly in `Delivery` or `Event`.

### 6. DBMS: Why is the composite index `(status, nextAttemptAt)` placed in that specific column order?
> **Answer:** Because the worker's polling query evaluates an equality condition on `status` (`status IN ('PENDING', 'FAILED')`) and a range filter on `nextAttemptAt` (`nextAttemptAt <= NOW()`). Under the B-Tree Leftmost Prefix Rule, placing the equality column first isolates the exact branch of the B-Tree, and the second column allows an efficient index range scan without reading unrelated rows.

### 7. DBMS: What does MySQL's `EXPLAIN` show for your worker query before and after adding that index?
> **Answer:** Without the index, `EXPLAIN` reports `type: ALL`, `key: NULL`, and `Extra: Using where`—a full table scan reading every row on disk. With the composite index, it reports `type: range`, `key: deliveries_status_nextAttemptAt_idx`, `filtered: 100%`, and `Extra: Using index condition`, reducing disk reads to only the exact due jobs.

### 8. DBMS: Why must event ingestion and delivery creation execute in a single ACID transaction?
> **Answer:** If we created the `Event` record and then experienced a process crash or database timeout before creating the `Delivery` rows, the event would be saved as "received", but no deliveries would ever be dispatched (the "Dual-Write" partial failure problem). Wrapping them in `prisma.$transaction()` guarantees atomicity: both are committed together or rolled back completely.

### 9. Networks & Security: How do you prevent Server-Side Request Forgery (SSRF)?
> **Answer:** Naive string checks (like checking if the URL starts with `localhost`) can be bypassed via DNS rebinding or alternative IP formats. I resolve the hostname to all IP addresses using `dns.promises.lookup()` and execute bitwise CIDR mask checks against loopback (`127.0.0.0/8`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata (`169.254.169.254`).

### 10. Web Security: Why use `crypto.timingSafeEqual` for HMAC signature verification?
> **Answer:** Standard string comparison operators (`===`) fail-fast on the first mismatching byte. By measuring microscopic response latency variations (timing attacks), an attacker could infer the correct signature character by character. `crypto.timingSafeEqual` runs in constant time regardless of where differences occur, closing the timing side channel.

### 11. Web Security: Why hash API keys with SHA-256 instead of bcrypt?
> **Answer:** User passwords have low entropy and require slow, salted hashing (`bcrypt` work factor 10) to thwart dictionary attacks. API keys are cryptographically generated with high entropy (>128 bits of randomness), meaning rainbow tables are computationally impossible. Using fast SHA-256 hashing allows our authentication middleware to verify API keys in $<0.5\text{ ms}$ while still protecting the database against plaintext credential leaks.

### 12. Computer Networks: How do you handle dead or slow subscriber endpoints?
> **Answer:** Standard HTTP sockets can hang indefinitely. HookRelay attaches an `AbortController` signal to the native `fetch` call with a 10-second timeout. If the remote receiver fails to respond within 10,000ms, the request is aborted, an error is recorded, and the delivery enters exponential backoff retry.

### 13. System Design: What is a Circuit Breaker, and how does your implementation work?
> **Answer:** The Circuit Breaker pattern prevents an application from repeatedly attempting an operation that is guaranteed to fail. HookRelay tracks `consecutiveFailures` per endpoint. After 5 consecutive failures, the endpoint is automatically paused (`isPaused = true`), stopping worker dispatches until an operator investigates and clicks "Resume" in the dashboard.

### 14. System Design: Where did you apply the Observer pattern?
> **Answer:** I used Node's native `EventEmitter` (`src/utils/eventBus.js`). The worker dispatches deliveries and emits lifecycle events (`delivery.succeeded`, `delivery.failed`, `endpoint.paused`). Independent modules (the live metrics aggregator, circuit breaker monitor, and future alerting listeners) subscribe to these events without tightly coupling their logic into the worker loop.

### 15. Probability & Statistics: How does your Z-Score anomaly detector identify problematic endpoints?
> **Answer:** The Z-score measures how many standard deviations an observation is from the mean: $z = \frac{x - \mu}{\sigma}$. I compute the population mean failure rate $\mu$ and sample standard deviation $\sigma$ (with Bessel's correction $N-1$) across all endpoints. Any endpoint whose failure rate has $z \ge 2.0$ is flagged as an `ANOMALY`, as it lies in the extreme top $2.5\%$ tail of a normal distribution.

### 16. Statistics: What is the difference between p50 and p95 latency, and how do you calculate them?
> **Answer:** $P_{50}$ (median) represents typical performance (50% of requests are faster). $P_{95}$ represents tail latency (only 5% of requests take longer). To calculate them, I sort all delivery attempt latencies ascending and select the element at index $\lfloor 0.50 \times N \rfloor$ for $P_{50}$ and $\lfloor 0.95 \times N \rfloor$ for $P_{95}$.

### 17. System Design: Why use MySQL as a durable queue instead of Redis or RabbitMQ?
> **Answer:** This was a deliberate architectural trade-off. Relational database queues offer ACID transaction durability: if the server restarts, no deliveries are lost, and we avoid the operational complexity of managing two distributed stateful datastores (MySQL + Redis). The limitation is single-worker polling throughput (~500–1,000 deliveries/sec), which is more than sufficient for this project's requirements.

### 18. Scalability: How would you scale HookRelay to multiple worker instances in the future?
> **Answer:** If multiple worker processes polled MySQL simultaneously, they would suffer from row-level lock contention and duplicate delivery dispatch. To scale horizontally, I would either:
> 1. Use PostgreSQL with `FOR UPDATE SKIP LOCKED` to allow parallel workers to claim jobs without locking.
> 2. Partition the queue using a dedicated distributed log like Apache Kafka or Redis Streams, where each partition is assigned to a single consumer worker.

### 19. Web Programming: Why did you use `useReducer` in the Deliveries page?
> **Answer:** The deliveries table manages interdependent filter states (`status`, `endpointId`, `page`). Using multiple `useState` setters causes multiple re-renders and potential race conditions (e.g. changing status while on page 4). `useReducer` executes state transitions atomically: applying a filter automatically resets `page = 1` in a single synchronized state update.

### 20. Honest Project Evaluation: What are the main limitations of your project?
> **Answer:**
> 1. Single worker process: The in-process worker does not support horizontal multi-node scaling without row lock contention.
> 2. In-memory TokenBucket: Rate limit buckets are stored in process memory, meaning restarting the server resets burst allowances, and running behind a multi-server load balancer would require Redis for shared token state.
> 3. Polling overhead: Database polling at 1-second intervals introduces up to 1 second of latency before a scheduled retry is picked up.
