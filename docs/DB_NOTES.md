# Database Engineering & Query Analysis (HookRelay)

*Course Alignment: Database Management Systems (DBMS) — Schema Normalization, ACID Transactions, and Query Optimization via B-Tree Indexes.*

---

## 1. Third Normal Form (3NF) Justification

To prevent update, insertion, and deletion anomalies, our MySQL schema adheres strictly to **Third Normal Form (3NF)**:

### First Normal Form (1NF)
- Every table has a primary key (`id` generated via UUIDv4).
- Every column stores atomic, single values.
- Repeating groups are eliminated: individual webhook delivery attempts are not stored as an array inside the `deliveries` table; they reside in a separate `delivery_attempts` table.

### Second Normal Form (2NF)
- The schema is in 1NF.
- Every non-prime attribute depends on the whole candidate key. Since all entities use single-column primary keys (`id`), partial functional dependencies ($X \subset K \to Y$) are impossible.

### Third Normal Form (3NF)
- The schema is in 2NF.
- There are no **transitive functional dependencies** ($X \to Y \to Z$ where $Z$ is non-prime):
  - In `delivery_attempts`, status codes, latency, and error texts depend strictly on the attempt ID, not transitively on the delivery or user.
  - In `api_keys`, rate limits and key hashes depend on the API key ID, not on the user email.
  - In `events`, event payload data depends strictly on the event ID.

---

## 2. Query Optimization: The Poller Queue Index

In HookRelay, the delivery worker polls the database every second with the following query:

```sql
SELECT * FROM deliveries
WHERE status IN ('PENDING', 'FAILED')
  AND nextAttemptAt <= NOW()
ORDER BY nextAttemptAt ASC
LIMIT 20;
```

### Why a Composite B-Tree Index on `(status, nextAttemptAt)`?
Under MySQL InnoDB, a B-Tree index is ordered lexicographically by the leftmost column first, then subsequent columns.
1. `status` is evaluated with equality / `IN` filtering.
2. `nextAttemptAt` is evaluated as a range condition (`<= NOW()`).

According to the **Leftmost Prefix Rule**, placing the equality column first (`status`) narrows the B-Tree search to only active pending/failed jobs, and the second column (`nextAttemptAt`) allows an index range scan rather than a full table scan.

---

## 3. Real `EXPLAIN` Query Execution Plan Analysis

We evaluated the query performance using MySQL's native `EXPLAIN` tool on our database:

### Query Plan BEFORE Adding the Index (or forcing index ignore):
```sql
EXPLAIN SELECT * FROM deliveries 
IGNORE INDEX (deliveries_status_nextAttemptAt_idx) 
WHERE status = 'PENDING' AND nextAttemptAt <= NOW();
```

**Output:**
```text
+----+-------------+------------+------------+------+---------------+------+---------+------+------+----------+-------------+
| id | select_type | table      | partitions | type | possible_keys | key  | key_len | ref  | rows | filtered | Extra       |
+----+-------------+------------+------------+------+---------------+------+---------+------+------+----------+-------------+
|  1 | SIMPLE      | deliveries | NULL       | ALL  | NULL          | NULL | NULL    | NULL |   82 |     3.33 | Using where |
+----+-------------+------------+------------+------+---------------+------+---------+------+------+----------+-------------+
```

- `type: ALL` $\to$ **Full Table Scan!** The database engine had to read every single row in the `deliveries` table from disk.
- `key: NULL` $\to$ No index was utilized.
- `filtered: 3.33%` $\to$ $96.67\%$ of rows read from disk were discarded in memory.
- **Complexity:** $O(N)$ where $N$ is total deliveries in the platform. At 500,000 deliveries, this query causes severe disk I/O thrashing and locks table pages.

---

### Query Plan AFTER Adding Composite Index `(status, nextAttemptAt)`:
```sql
EXPLAIN SELECT * FROM deliveries 
WHERE status = 'PENDING' AND nextAttemptAt <= NOW();
```

**Output:**
```text
+----+-------------+------------+------------+-------+-------------------------------------+-------------------------------------+---------+------+------+----------+-----------------------+
| id | select_type | table      | partitions | type  | possible_keys                       | key                                 | key_len | ref  | rows | filtered | Extra                 |
+----+-------------+------------+------------+-------+-------------------------------------+-------------------------------------+---------+------+------+----------+-----------------------+
|  1 | SIMPLE      | deliveries | NULL       | range | deliveries_status_nextAttemptAt_idx | deliveries_status_nextAttemptAt_idx | 773     | NULL |   24 |   100.00 | Using index condition |
+----+-------------+------------+------------+-------+-------------------------------------+-------------------------------------+---------+------+------+----------+-----------------------+
```

- `type: range` $\to$ **Index Range Scan!** MySQL traverses directly down the B-Tree to `status = 'PENDING'` and scans only records where `nextAttemptAt <= NOW()`.
- `key: deliveries_status_nextAttemptAt_idx` $\to$ Utilizes our composite B-tree index.
- `filtered: 100.00%` $\to$ Every row fetched from the index matches the query condition; 0 wasted row reads.
- **Complexity:** $O(\log N + K)$ where $K$ is the number of due rows. Polling executes in $<1\text{ ms}$ regardless of how many millions of historical completed deliveries exist.

