# Architecture & Engineering Decisions (HookRelay)

*Maintained by a 3rd-year CS & AI student building a practical webhook delivery platform.*

---

## 1. Why MySQL as a Durable Queue Instead of Redis or RabbitMQ?
- **Decision:** Use a `deliveries` table in MySQL 8 to store queued and scheduled jobs, combined with an in-process worker polling due jobs into a custom in-memory binary `MinHeap`.
- **Reasoning:**
  - In our distributed systems and DBMS classes, we learned that introducing Redis or RabbitMQ brings an additional point of failure and operational complexity (managing two stateful datastores, handling 2-phase commits or split-brain states between MySQL and Redis).
  - Webhook delivery requires durability: if the server restarts, we cannot afford to lose undelivered webhooks. A relational database table with an index on `(status, nextAttemptAt)` guarantees durability under ACID guarantees.
- **Trade-off & Limitations:**
  - Polling a relational database under heavy concurrency can lead to table lock contention if multiple workers poll simultaneously.
  - For this project, a single worker process polling in batches is more than sufficient (handles ~500-1000 deliveries/sec). In a production scale-out scenario, we would adopt PostgreSQL with `SKIP LOCKED` or migrate to a partitioned queue like Apache Kafka or Redis Streams.

---

## 2. Database Normalization (3NF) & Index Strategy
- **Decision:** Strictly normalize tables to Third Normal Form (3NF) and introduce composite indexes tailored to delivery queue queries.
- **Entities:**
  - `User` $\rightarrow$ `ApiKey` (1:N)
  - `User` $\rightarrow$ `WebhookEndpoint` (1:N)
  - `Event` $\rightarrow$ `Delivery` (1:N)
  - `WebhookEndpoint` $\rightarrow$ `Delivery` (1:N)
  - `Delivery` $\rightarrow$ `DeliveryAttempt` (1:N)
- **Normal Form Justification:**
  - **1NF:** All fields store atomic scalar values (arrays like `eventTypes` are stored as JSON representations).
  - **2NF:** All non-key attributes depend fully on the primary key (UUID).
  - **3NF:** No transitive functional dependencies (e.g., attempt status codes and latency belong strictly in `DeliveryAttempt`, while delivery state belongs in `Delivery`).
- **Indexes:**
  - `deliveries(status, nextAttemptAt)`: Composite B-tree index so the worker query `WHERE status = 'PENDING' AND nextAttemptAt <= NOW()` runs as a fast range scan rather than a full table scan.
  - `delivery_attempts(deliveryId)`: Enables instantaneous rendering of the delivery attempt timeline drawer in the dashboard.
  - `events(idempotencyKey)`: Unique constraint prevents duplicate webhook events from identical external triggers.

---

## 3. Security: Hashing API Keys & Secrets
- **Decision:** Never store raw API keys. Only store SHA-256 hashes (`keyHash`) and expose a 12-character prefix (`hr_live_...`) for user identification in the UI.
- **Reasoning:**
  - Standard industry practice (used by Stripe and GitHub). If the database is compromised, active API keys cannot be stolen in plaintext.
  - We use standard `crypto.createHash('sha256')` rather than bcrypt for API keys because API keys have high entropy (>128 bits of randomness), meaning rainbow table attacks are computationally infeasible, and fast SHA-256 verification keeps middleware latency $<1\text{ ms}$.
  - User passwords, by contrast, use `bcrypt` with salt rounds = 10 because human-chosen passwords have low entropy and require slow key derivation to thwart brute-force attacks.

---

## 4. Environment Configuration & Docker Layout
- **Decision:** Support both Docker Compose containerization and standalone local running with socket / TCP fallback.
- **Reasoning:**
  - Evaluators or professors running this on diverse laptops (macOS Apple Silicon, Linux, Windows WSL) may or may not have Docker Desktop running. Providing `.env` support for both port 3306/3307 and unix domain socket ensures anyone can run `npm start` immediately.

