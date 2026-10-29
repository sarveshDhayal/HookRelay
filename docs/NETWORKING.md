# Computer Networks & Web Security Guide (HookRelay)

*Course Alignment: Computer Networks & Network Security — HTTP Protocols, HMAC Signatures, SSRF Mitigation, and Packet Analysis.*

---

## 1. Outbound HTTP Headers & Signature Scheme

When HookRelay dispatches an HTTP POST webhook, it sends the following standard headers:

| Header Name | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `Content-Type` | MIME | Format of request payload | `application/json` |
| `User-Agent` | Identifier | Worker client user agent | `HookRelay-Worker/1.0` |
| `X-HookRelay-Event-Id` | UUID | Unique ID of originating event | `a1b2c3d4-e5f6-7890-abcd-1234567890ab` |
| `X-HookRelay-Delivery-Id` | UUID | Unique ID of delivery job | `d4c3b2a1-6f5e-0987-dcba-ba0987654321` |
| `X-HookRelay-Timestamp` | Unix Epoch | Seconds timestamp of dispatch | `1700000000` |
| `X-HookRelay-Signature` | Hex Digest | HMAC-SHA256 signature | `e3b0c44298fc1c149afbf4c8996fb924...` |

### HMAC-SHA256 Signing Specification (Stripe Standard)
To prove to the subscriber that the request originated from HookRelay and was not tampered with in transit:
1. Concatenate timestamp and raw body:
   $$\text{signedPayload} = \text{timestamp} + \text{"."} + \text{JSON.stringify(body)}$$
2. Compute HMAC:
   $$\text{signature} = \text{HMAC-SHA256}(\text{endpoint.secret}, \text{signedPayload})$$
3. Verification on the receiver must use **constant-time byte comparison** (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
4. The receiver should also check that $|t_{\text{current}} - t_{\text{header}}| \le 300\text{ seconds}$ to prevent **replay attacks**.

---

## 2. Server-Side Request Forgery (SSRF) Defense in Depth

### The Threat
Allowing users to register arbitrary webhook URLs introduces SSRF. An attacker might provide:
- `http://169.254.169.254/latest/meta-data/` (Steals AWS IAM role temporary credentials)
- `http://localhost:3306` (Probes MySQL database directly from inside the network)
- `http://10.0.0.15:8080/admin` (Attacks internal Kubernetes microservices)

### The HookRelay Defense Architecture (`src/utils/ssrf.js`)
1. **URL Protocol Guard:** Accepts only `http:` and `https:`. Blocks `file://`, `ftp://`, `gopher://`.
2. **Recursive DNS Resolution:** Resolves hostname via `dns.promises.lookup(hostname, { all: true })` to uncover all candidate IPv4 and IPv6 addresses. This prevents DNS Rebinding attacks.
3. **CIDR Subnet Bitmask Verification:** Converts IPv4 into 32-bit integer and applies bitwise masks (`(ip & mask) === (range & mask)`):
   - `127.0.0.0/8` (Loopback)
   - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 Private)
   - `169.254.0.0/16` (Link-local & Cloud Metadata)
   - `::1`, `fe80::/10`, `fc00::/7` (IPv6 Private)

---

## 3. HTTP Timeout Enforcement via AbortController

In standard TCP, an unresponsive remote server can keep an HTTP socket connection half-open indefinitely, consuming worker file descriptors.

HookRelay enforces a strict 10-second timeout:
```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(endpoint.url, {
    method: 'POST',
    body: payloadString,
    signal: controller.signal,
  });
} catch (err) {
  if (err.name === 'AbortError') {
    // Delivery timed out after 10,000ms
  }
} finally {
  clearTimeout(timeout);
}
```

---

## 4. How to Verify a Delivery in Wireshark (Packet Analysis)

To capture and inspect HookRelay webhook deliveries in Wireshark:

### Step 1: Start Wireshark Capture
1. Open Wireshark and select your network interface:
   - For local mock testing (`localhost:4001`), select **Loopback: lo0** (macOS) or **Adapter for loopback traffic** (Windows/Linux).
   - For external endpoints, select your active Wi-Fi or Ethernet interface (`en0` / `eth0`).

### Step 2: Apply Display Filter
In the Wireshark filter bar, enter:
```text
http.request.method == "POST" && tcp.port == 4001
```
*(Or `tcp.port == 4000` to capture ingestion).*

### Step 3: Trigger a Webhook Delivery
In your terminal, trigger a delivery:
```bash
npm run demo
```

### Step 4: Inspect TCP & HTTP Layers in Wireshark
1. **Frame & Ethernet II:** View MAC addresses and payload frame size.
2. **Internet Protocol Version 4:**
   - Source IP: `127.0.0.1`
   - Destination IP: `127.0.0.1`
3. **Transmission Control Protocol (TCP):**
   - Source Port: Ephemeral worker port (e.g. `54321`)
   - Destination Port: `4001` (Mock receiver)
   - Observe the 3-Way Handshake (`[SYN]`, `[SYN, ACK]`, `[ACK]`).
4. **Hypertext Transfer Protocol (HTTP):**
   - Click on the `POST /webhook HTTP/1.1` packet.
   - Expand **Request Headers**:
     - `X-HookRelay-Signature: ...`
     - `X-HookRelay-Timestamp: ...`
     - `X-HookRelay-Event-Id: ...`
   - View **File Data / JSON**: Inspect the serialized body `{ "customer": "alice@student.dev", ... }`.
5. **Follow TCP Stream:** Right-click the packet and select **Follow $\to$ TCP Stream** to view the full bidirectional plaintext ASCII exchange.

