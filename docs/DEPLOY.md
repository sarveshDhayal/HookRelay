# Production Deployment Guide (HookRelay)

*Deployment instructions for AWS EC2 (Docker) and PaaS alternatives (Render / Railway).*

---

## 1. Option A: Deployment on AWS EC2 with Docker

### Step 1: Provision EC2 Instance
1. Launch an **Ubuntu 24.04 LTS (t3.small or t3.medium)** instance.
2. Configure EBS Volume with at least 20 GB gp3 storage.

### Step 2: Configure AWS Security Group
Add the following Inbound Rules:

| Type | Port Range | Protocol | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | `22` | TCP | `Your_IP/32` | Administrative access |
| **Custom TCP** | `4000` | TCP | `0.0.0.0/0` | HookRelay API & Dashboard |
| **Custom TCP** | `3306` | TCP | *Restricted to VPC* | Internal MySQL database (never open to 0.0.0.0/0) |

### Step 3: Server Setup & Docker Installation
Connect via SSH:
```bash
ssh -i your-key.pem ubuntu@ec2-your-instance-ip.compute-1.amazonaws.com

# Update packages and install Docker
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git

# Allow ubuntu user to execute docker
sudo usermod -aG docker ubuntu
newgrp docker
```

### Step 4: Clone Repository & Deploy
```bash
git clone https://github.com/your-username/HookRelay.git
cd HookRelay

# Configure production environment
cp .env.example .env
nano .env # Set strong JWT secrets and passwords

# Start containers with Docker Compose
docker compose up -d --build

# Run schema migrations and seed data
docker compose exec api npx prisma db push
docker compose exec api npm run prisma:seed
```

### Step 5: Verify Deployment
Open your browser at `http://ec2-your-instance-ip.compute-1.amazonaws.com:4000/`.

---

## 2. Option B: Deployment on Render / Railway

For low-maintenance cloud deployments with managed databases:

### Using Railway:
1. Connect your GitHub repository to Railway.
2. Add a **MySQL** plugin from the Railway Marketplace.
3. Configure Environment Variables on the web service:
   - `DATABASE_URL`: `${{ MySQL.DATABASE_URL }}`
   - `JWT_SECRET`: Generate a random 32-character string
   - `JWT_REFRESH_SECRET`: Generate a random 32-character string
   - `NODE_ENV`: `production`
4. Set Build Command:
   ```bash
   npm install && npx prisma generate && cd dashboard && npm install && npm run build
   ```
5. Set Start Command:
   ```bash
   npx prisma db push && npm start
   ```

---

## 3. Environment Variables Reference

| Variable | Required | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `4000` | HTTP port |
| `NODE_ENV` | No | `development` | Environment mode (`development`, `production`, `test`) |
| `DATABASE_URL` | **Yes** | — | MySQL connection string (`mysql://user:pass@host:3306/db`) |
| `JWT_SECRET` | **Yes** | — | Cryptographic secret for signing short-lived access JWTs |
| `JWT_REFRESH_SECRET`| **Yes** | — | Cryptographic secret for signing long-lived refresh JWTs |
| `DELIVERY_TIMEOUT_MS`| No | `10000` | Worker HTTP timeout |
| `CIRCUIT_BREAKER_THRESHOLD`| No | `5` | Consecutive failures before auto-pausing |

