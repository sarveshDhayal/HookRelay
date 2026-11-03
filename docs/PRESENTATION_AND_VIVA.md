# HookRelay — Complete Presentation & Viva Defense Guide

*A master study and presentation kit for college capstone evaluation, external viva examination, and technical project defense.*

---

## 🎯 Quick Links & Resources Created in Repository
1. **Interactive Slide Deck:** Open [`presentation.html`](../presentation.html) directly in any browser (Chrome, Edge, Safari, Firefox).
   - Press <kbd>&rarr;</kbd> or <kbd>Space</kbd> to change slides.
   - Press <kbd>N</kbd> to toggle **Speaker Notes & Viva Defense Drawer**.
   - Press <kbd>F</kbd> for **Fullscreen Presentation Mode**.
   - Press <kbd>P</kbd> or click **Export PDF** to save as a clean PDF handout for examiners.
2. **20 Technical Viva Questions:** Detailed in [`docs/INTERVIEW_QA.md`](./INTERVIEW_QA.md).
3. **Architecture Diagrams:** Detailed in [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).
4. **DSA Notes & Proofs:** Detailed in [`docs/DSA_NOTES.md`](./DSA_NOTES.md).
5. **DBMS 3NF Normalization:** Detailed in [`docs/DB_NOTES.md`](./DB_NOTES.md).

---

## 📑 Slide Deck Outline (12 Slides)

| Slide # | Slide Title | Core Academic Subject | Key Focus |
|:---:|:---|:---:|:---|
| **01** | **HookRelay: Production Webhook Delivery Platform** | Overview | Academic alignment, tech stack, and project goals |
| **02** | **Why Webhooks Break in Production Systems** | System Failures | 4 fatal flaws: Thread starvation, Thundering herds, SSRF, Dual-writes |
| **03** | **End-to-End System Architecture** | Software Engineering | Ingestion API &rarr; MySQL 8 ACID Queue &rarr; MinHeap Worker &rarr; Target |
| **04** | **Binary Min-Heap & Lazy Token Bucket** | **DAA / DSA** | $\mathcal{O}(\log N)$ priority queue, $\mathcal{O}(1)$ lazy refill rate limiting |
| **05** | **3NF Schema, ACID Transactions & Indexing** | **DBMS** | 3NF proofs, composite B-Tree index `(status, nextAttemptAt)`, Leftmost Prefix Rule |
| **06** | **SSRF Protection & Cryptographic Signatures** | **Networks & Security** | Bitwise CIDR subnet masking, RFC 1918 blocks, HMAC-SHA256, timing attacks |
| **07** | **Exponential Backoff, Full Jitter & Circuit Breaker** | **Distributed Systems** | Thundering herd mitigation, uniform random delay, 5-failure trip threshold |
| **08** | **Z-Score Anomaly Detection & Latency Percentiles** | **Probability & Stats** | $Z = \frac{x - \mu}{\sigma}$ anomaly detection ($z \ge 2.0$), $P_{50}$ and $P_{95}$ tail latencies |
| **09** | **React 18 + Vite Monitoring Dashboard** | **Web Dev & UI** | Real-time Recharts analytics, secret rotation, pause/resume controls |
| **10** | **11,000+ Req/s Throughput & 100% Test Coverage** | **Testing & QA** | Autocannon load testing, 50 automated tests in 13 suites (`node:test`) |
| **11** | **Live Demonstration Sequence (2 Minutes)** | **Live Demo** | Idempotency deduplication, mock 500 retry, circuit trip, 429 rate limit |
| **12** | **Conclusion, Future Scope & Viva Defense** | **Conclusion** | Scaling with Apache Kafka, geo-distributed edge workers, Q&A |

---

## 🎙️ Slide-by-Slide Presentation Script (What to Speak in Front of Evaluators)

### Slide 1: Title & Introduction
> **English:** "Good morning respected evaluators. Today I am presenting HookRelay, an enterprise-grade webhook delivery and observability platform. Webhooks are the backbone of modern distributed systems, used by Stripe, GitHub, and Shopify to communicate asynchronous events. However, building reliable webhooks is difficult because external receivers can hang, fail, or be exploited. HookRelay bridges core academic computer science—such as binary priority queues, database normalization, and network security—with production-grade software engineering."
> 
> **Hinglish Summary:** "HookRelay ek fault-tolerant webhook delivery platform hai. Ye external servers ko reliable tareeqe se event webhooks deliver karta hai, bina main server ko block kiye, custom DSA aur 3NF database architecture ke sath."

### Slide 2: Problem Statement & Motivation
> **English:** "Why do webhooks break in production? Standard implementations suffer from four fatal architectural flaws:
> 1. **Synchronous Thread Blocking:** Waiting on a slow subscriber exhausts server sockets.
> 2. **The Thundering Herd Problem:** Simultaneous retries overwhelm recovering servers.
> 3. **SSRF Vulnerabilities:** Malicious users register private IPs like `127.0.0.1` or AWS metadata `169.254.169.254` to steal credentials.
> 4. **The Dual-Write Bug:** Saving an event and scheduling delivery in separate steps causes phantom dropped webhooks during crashes.
> HookRelay systematically solves each of these four flaws."

### Slide 3: High-Level System Architecture
> **English:** "Here is the high-level flow of HookRelay. When a publisher sends `POST /v1/events`, our API Gateway verifies the API key and runs our lazy Token Bucket rate limiter in $\mathcal{O}(1)$ time. An atomic ACID transaction commits the event and its associated delivery jobs into MySQL. An asynchronous worker continuously loads due jobs into an in-memory MinHeap priority queue, computes HMAC-SHA256 signatures, and dispatches them with a 10-second `AbortController` timeout. An internal Observer EventBus decouples telemetry and circuit breaker updates."

### Slide 4: Core DSA — Binary MinHeap & Lazy Token Bucket
> **English:** "A key highlight of this project is our custom data structure engineering:
> 1. **Binary MinHeap:** JavaScript's `Array.sort()` takes $\mathcal{O}(N \log N)$ time. Instead, our MinHeap maps a complete binary tree into a flat array using parent-child arithmetic. Enqueuing and extracting take $\mathcal{O}(\log N)$, and inspecting the next due job takes $\mathcal{O}(1)$. The contiguous array structure maximizes CPU cache locality.
> 2. **Lazy Token Bucket:** Traditional rate limiters run background `setInterval` timers for every key, leaking memory and wasting CPU. We calculate elapsed time $\Delta t = \text{now} - \text{lastRefill}$ lazily on incoming requests. It runs in $\mathcal{O}(1)$ time and $\mathcal{O}(1)$ space."

### Slide 5: DBMS — 3NF Schema & B-Tree Indexing
> **English:** "Our relational schema strictly satisfies Third Normal Form (3NF). Every attribute is atomic (1NF); non-key attributes depend fully on the primary key (2NF); and there are zero transitive dependencies (3NF).
> Furthermore, under the B-Tree Leftmost Prefix Rule, we created a composite index on `(status, nextAttemptAt)`. Because our worker query filters by equality on `status` and a range on `nextAttemptAt`, MySQL performs an index range scan rather than a 500,000-row full table scan, dropping disk I/O to near zero."

### Slide 6: Networks & Security — SSRF Prevention & HMAC Signing
> **English:** "To protect against Server-Side Request Forgery, simple regex checks on `localhost` fail against DNS rebinding or hex encodings. HookRelay resolves the domain asynchronously via `dns.promises.lookup()`, parses resolved IPv4 addresses into 32-bit unsigned integers, and executes bitwise CIDR mask checks against loopback (`127.0.0.0/8`), RFC 1918 private subnets, and cloud metadata (`169.254.169.254`).
> For payload authenticity, we sign bodies using HMAC-SHA256 and compare signatures using `crypto.timingSafeEqual` to prevent microsecond timing attacks."

### Slide 7: Resiliency — Full Jitter & Circuit Breaker
> **English:** "Deterministic exponential backoff causes retries to align at the exact same second, generating a Thundering Herd that crashes recovering services. HookRelay implements **Full Jitter** (recommended by AWS Architecture): we pick a uniform random delay between 0 and the exponential ceiling $T = \text{base} \times 2^{\text{attempt}}$.
> Additionally, our Circuit Breaker automatically pauses any webhook endpoint that experiences 5 consecutive failures, isolating broken downstream services and preventing worker thread starvation."

### Slide 8: Observability — Z-Score Anomaly Detection & Latency
> **English:** "Instead of naive arithmetic means that mask latency spikes, HookRelay computes $P_{50}$ (median) and $P_{95}$ (tail latency) using rank-order array selection.
> We also implemented an automated statistical anomaly detector using Z-Scores: $Z = \frac{x - \mu}{\sigma}$, applying Bessel's correction ($N - 1$) for sample standard deviation. Any endpoint whose failure rate has $z \ge 2.0$ represents the extreme top $2.5\%$ outlier of a normal distribution and is flagged as an anomaly."

### Slide 9: Frontend Monitoring Dashboard
> **English:** "Our operational dashboard is built with React 18, Vite, and Tailwind CSS. It communicates with our Express backend and renders interactive delivery charts and latency curves using Recharts. Operators can create endpoints, inspect cryptographic secrets, toggle pause/resume states, and perform deep packet inspection of HTTP headers, response bodies, and error stacks."

### Slide 10: Validation & Benchmarks
> **English:** "Under Autocannon load testing with 10 concurrent connections, HookRelay sustained over 11,200 requests per second with an ingestion median latency of only 0.58 milliseconds. Furthermore, we wrote 50 automated unit and integration tests across 13 test suites using Node's native test runner (`node:test`), achieving 100% test success across data structures, authentication, backoff math, and SSRF security."

### Slide 11: Live Demonstration
> *(Run `npm run demo` or walk through the dashboard as explained in the Live Demo section below).*

### Slide 12: Conclusion & Future Scope
> **English:** "HookRelay proves how core computer science theory directly powers scalable, resilient distributed systems. In the future, we plan to support Apache Kafka for horizontal partitioning across multi-node worker clusters, and implement mutual TLS (mTLS) for zero-trust enterprise webhooks. Thank you, and I am now ready for your questions."

---

## 🎯 Top 10 Viva "Trap" Questions & Examiner Counter-Answers

### Q1: "Why not use Redis instead of MySQL for your queue?"
> **Counter-Answer:** "Redis is primarily an in-memory store. In a student or cost-constrained environment, if Redis restarts without AOF/RDB persistence configured, queued jobs are permanently lost. MySQL provides ACID guarantees, foreign key integrity, and durable persistence out of the box. By adding our composite index `(status, nextAttemptAt)` and pairing MySQL with an in-process MinHeap priority queue, we achieve the durability of a relational database with the sub-millisecond retrieval speeds of an in-memory queue."

### Q2: "Why did you build your own MinHeap instead of `Array.prototype.sort()`?"
> **Counter-Answer:** "`Array.prototype.sort()` takes $\mathcal{O}(N \log N)$ time and re-sorts the entire collection every time a single retry job is scheduled. Our binary Min-Heap allows us to insert and extract jobs in $\mathcal{O}(\log N)$ time, and inspect the earliest due job in $\mathcal{O}(1)$ time. Because it is mapped onto a contiguous array, it has zero pointer overhead and maximizes CPU cache locality."

### Q3: "What is the difference between Bessel's correction ($N-1$) and standard deviation with $N$ in your Z-Score?"
> **Counter-Answer:** "When calculating standard deviation from a small sample rather than an entire infinite population, dividing by $N$ produces a downward bias—it underestimates true variance. Bessel's correction divides by $N-1$ to provide an unbiased estimator of population variance, which is critical when monitoring a small cluster of endpoints."

### Q4: "Why use SHA-256 for API keys but bcrypt for user passwords?"
> **Counter-Answer:** "User passwords have low entropy and are vulnerable to dictionary attacks, requiring slow, computationally heavy hashing (`bcrypt` with work factor 10). API keys are cryptographically generated with high entropy (>128 bits of randomness), making dictionary and rainbow table attacks computationally impossible. Fast SHA-256 hashing allows our authentication middleware to verify API keys in $<0.5\text{ ms}$ while still protecting the database against plaintext leaks."

### Q5: "How does your SSRF protection prevent DNS Rebinding attacks?"
> **Counter-Answer:** "In a DNS Rebinding attack, an attacker configures their public domain's DNS TTL to 0 seconds. The initial check resolves to a public IP, but during actual HTTP request dispatch, it resolves to `127.0.0.1`. HookRelay mitigates this by resolving the hostname via `dns.promises.lookup({ all: true })` and validating all returned IP addresses against private CIDR masks immediately before establishing the HTTP connection."

### Q6: "Why is the composite index ordered `(status, nextAttemptAt)` instead of `(nextAttemptAt, status)`?"
> **Counter-Answer:** "According to the B-Tree Leftmost Prefix Rule, equality columns must precede range columns. The worker query checks `status IN ('PENDING', 'FAILED')` (equality) and `nextAttemptAt <= NOW()` (range). If `nextAttemptAt` were first, MySQL would perform an index range scan on time and could not use the index branch for `status` filtering."

### Q7: "Why did you use `crypto.timingSafeEqual` instead of `===` for HMAC signatures?"
> **Counter-Answer:** "The standard `===` operator fails-fast on the first mismatching character. An attacker measuring microscopic differences in response time (timing side-channel) could infer correct signature characters one by one. `crypto.timingSafeEqual` executes in constant time regardless of where differences occur, closing the timing side channel."

### Q8: "What happens if the external subscriber takes 30 seconds to reply?"
> **Counter-Answer:** "Standard Node.js sockets can hang indefinitely. HookRelay binds an `AbortController` signal with a 10,000ms (10-second) timeout to the native `fetch` dispatch. If the subscriber fails to reply within 10 seconds, the promise is aborted, a timeout error is recorded in `DeliveryAttempt`, and the delivery enters exponential retry."

### Q9: "Why return HTTP 202 Accepted instead of HTTP 200 OK on event ingestion?"
> **Counter-Answer:** "Under RFC 9110, HTTP 200 indicates that the requested action has been completed. HTTP 202 indicates that the request has been accepted for processing, but processing has not yet completed. Because webhook delivery is handled asynchronously by our background worker out-of-band, HTTP 202 is the architecturally correct REST status code."

### Q10: "If your system experiences a crash, will any webhooks be lost?"
> **Counter-Answer:** "No. Event ingestion and delivery row creation are wrapped in a single ACID `prisma.$transaction()`. If the system crashes mid-request, the transaction rolls back, and the client receives a failure response to retry. If it commits, the delivery is durably recorded in MySQL with `status: PENDING`. When the system restarts, the worker polls all pending jobs where `nextAttemptAt <= NOW()` and resumes delivery seamlessly."

---

## 🚀 Live Demo Execution Guide (2-Minute Examiner Walkthrough)

To present the live working project to evaluators:

### Step 1: Start the Servers
Open two terminal tabs:
```bash
# Terminal 1: Start Mock Receiver (simulates external subscriber)
node tools/mock-receiver/server.js

# Terminal 2: Start HookRelay Engine + Dashboard
npm start
```

### Step 2: Run the Automated 2-Minute Demo Script
In Terminal 3, run:
```bash
npm run demo
```
This automated demo script executes 5 live scenarios sequentially with colored CLI output:
1. **Scenario 1:** Ingests an event and displays immediate HTTP 202 Accepted.
2. **Scenario 2:** Demonstrates Idempotency (repeating the same key returns cached 200 without duplicate deliveries).
3. **Scenario 3:** Simulates delivery failure and shows exponential backoff calculation in real time.
4. **Scenario 4:** Trips the Circuit Breaker after 5 consecutive failures and displays auto-paused status.
5. **Scenario 5:** Triggers Token Bucket rate limiting and prints HTTP 429 Too Many Requests.

### Step 3: Show the Dashboard in Browser
Open `http://localhost:4000` in Chrome:
- **Login:** `student@hookrelay.dev` / `Password123!`
- Show the **Live Delivery Metrics** (Success/Failure charts).
- Show the **Endpoints List** with the Circuit Breaker status badge.
- Click **Inspect** on any delivery to show the exact request payload, response status, headers, and latency.

