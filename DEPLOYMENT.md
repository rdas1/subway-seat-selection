# Deployment Guide

This guide covers deploying the Subway Seat Selection application to Google Cloud Run and AWS EC2.

## Prerequisites

- Docker installed locally
- Docker Hub account (or Google Container Registry / AWS ECR)
- Google Cloud SDK installed (for Cloud Run) OR AWS CLI installed (for EC2)

## Local Development with Docker

### Quick Start

```bash
# Build and start all services
docker-compose up --build

# Access the application:
# Frontend: http://localhost
# Backend: http://localhost:8000
# Database: localhost:5432
```

### Individual Services

```bash
# Build and run only the database
docker-compose up postgres

# Build and run only the backend
docker-compose up backend

# Build and run only the frontend
docker-compose up frontend
```

### Production-like Local Setup

```bash
docker-compose -f docker-compose.prod.yml up --build
```

---

## Google Cloud Run Deployment

### Overview

Cloud Run is a serverless platform that automatically scales containers. Each service (backend/frontend) should be deployed separately.

### Step 1: Set Up Google Cloud

```bash
# Install Google Cloud SDK (if not installed)
# macOS: brew install google-cloud-sdk
# Or download from: https://cloud.google.com/sdk/docs/install

# Login and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

### Step 2: Set Up Cloud SQL (PostgreSQL)

```bash
# Create Cloud SQL instance
gcloud sql instances create subway-postgres \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create subway_seat_selection --instance=subway-postgres

# Create user
gcloud sql users create dbuser \
  --instance=subway-postgres \
  --password=YOUR_SECURE_PASSWORD

# Get connection name (needed for Cloud Run)
gcloud sql instances describe subway-postgres --format="value(connectionName)"
# Save this connection name for later
```

### Step 3: Build and Push Docker Images

```bash
# Configure Docker to use gcloud
gcloud auth configure-docker

# Build and push backend
cd backend
docker build -t gcr.io/YOUR_PROJECT_ID/subway-backend .
docker push gcr.io/YOUR_PROJECT_ID/subway-backend

# Build and push frontend
cd ../frontend
docker build -t gcr.io/YOUR_PROJECT_ID/subway-frontend .
docker push gcr.io/YOUR_PROJECT_ID/subway-frontend
```

### Step 4: Deploy Backend to Cloud Run

```bash
gcloud run deploy subway-backend \
  --image gcr.io/YOUR_PROJECT_ID/subway-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances YOUR_CONNECTION_NAME \
  --set-env-vars "DATABASE_URL=postgresql+asyncpg://dbuser:YOUR_SECURE_PASSWORD@/subway_seat_selection?host=/cloudsql/YOUR_CONNECTION_NAME" \
  --set-env-vars "CORS_ORIGINS=https://YOUR_FRONTEND_URL" \
  --memory 512Mi \
  --cpu 1
```

Note the backend URL from the output (e.g., `https://subway-backend-xxx.run.app`)

### Step 5: Deploy Frontend to Cloud Run

Update `frontend/vite.config.ts` to use your backend URL in production, then:

```bash
gcloud run deploy subway-frontend \
  --image gcr.io/YOUR_PROJECT_ID/subway-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "VITE_API_URL=https://YOUR_BACKEND_URL" \
  --memory 256Mi \
  --cpu 1
```

### Step 6: Update Frontend Environment

Rebuild the frontend with the correct backend URL:

1. Update `frontend/.env.production`:
   ```
   VITE_API_URL=https://your-backend-url.run.app
   ```

2. Rebuild and redeploy:
   ```bash
   cd frontend
   docker build -t gcr.io/YOUR_PROJECT_ID/subway-frontend .
   docker push gcr.io/YOUR_PROJECT_ID/subway-frontend
   gcloud run deploy subway-frontend --image gcr.io/YOUR_PROJECT_ID/subway-frontend
   ```

---

## AWS EC2 Deployment

### Overview

Deploy all services to a single EC2 instance or use ECS for container orchestration. This guide covers EC2 with Docker Compose.

### Step 1: Launch EC2 Instance

1. In AWS Console, launch an EC2 instance:
   - AMI: Amazon Linux 2023 or Ubuntu 22.04
   - Instance type: t3.medium or larger (recommended)
   - Security Group: Allow inbound on ports 22, 80, 443, 8000
   - Storage: 20GB minimum

2. Connect to instance:
   ```bash
   ssh -i your-key.pem ec2-user@YOUR_EC2_IP
   # Or for Ubuntu:
   ssh -i your-key.pem ubuntu@YOUR_EC2_IP
   ```

### Step 2: Install Docker and Docker Compose

```bash
# Amazon Linux 2023
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Ubuntu
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu

# Logout and login again for group changes to take effect
```

### Step 3: Set Up RDS PostgreSQL (Recommended)

1. In AWS Console, create RDS PostgreSQL instance:
   - Engine: PostgreSQL 15
   - Instance class: db.t3.micro (free tier)
   - Master username: postgres
   - Master password: (choose secure password)
   - Database name: subway_seat_selection

2. Note the endpoint URL (e.g., `subway-db.xxxxx.us-east-1.rds.amazonaws.com`)

### Step 4: Clone and Configure Application

```bash
# On EC2 instance
git clone YOUR_REPO_URL
cd subway-seat-selection

# Create .env file for production
cat > .env << EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_RDS_PASSWORD
POSTGRES_DB=subway_seat_selection
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_RDS_PASSWORD@subway-db.xxxxx.us-east-1.rds.amazonaws.com:5432/subway_seat_selection
CORS_ORIGINS=http://YOUR_EC2_IP,https://YOUR_DOMAIN
VITE_API_URL=http://YOUR_EC2_IP:8000
EOF
```

### Step 5: Deploy with Docker Compose

```bash
# If using RDS, update docker-compose.prod.yml to remove postgres service
# Or comment it out

docker-compose -f docker-compose.prod.yml up -d --build
```

### Step 6: Set Up Reverse Proxy (Optional but Recommended)

Install Nginx to handle HTTPS and route traffic:

```bash
sudo yum install -y nginx  # Amazon Linux
# OR
sudo apt install -y nginx  # Ubuntu

# Create nginx config
sudo nano /etc/nginx/conf.d/subway.conf
```

Add:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 7: Set Up SSL with Let's Encrypt (Optional)

```bash
sudo yum install -y certbot python3-certbot-nginx  # Amazon Linux
# OR
sudo apt install -y certbot python3-certbot-nginx  # Ubuntu

sudo certbot --nginx -d YOUR_DOMAIN
```

---

## Environment Variables

### Backend

- `DATABASE_URL`: PostgreSQL connection string
- `CORS_ORIGINS`: Comma-separated list of allowed origins (or `*` for all)

### Frontend

- `VITE_API_URL`: Backend API URL (set during build)

---

## Monitoring and Logs

### Cloud Run

```bash
# View logs
gcloud run logs read subway-backend --region us-central1
gcloud run logs read subway-frontend --region us-central1

# Monitor in console
# https://console.cloud.google.com/run
```

### EC2

```bash
# View Docker logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend

# System logs
sudo journalctl -u docker -f
```

---

## Scaling

### Cloud Run

- Auto-scales based on traffic
- Configure min/max instances in Cloud Run console
- Set CPU and memory limits per request

### EC2

- Manual: Launch multiple EC2 instances behind a load balancer
- Auto Scaling: Use AWS Auto Scaling Groups
- ECS: Consider using AWS ECS for better container orchestration

---

## Troubleshooting

### Database Connection Issues

- Verify security groups/firewall rules allow connections
- Check DATABASE_URL format
- For Cloud Run: Ensure Cloud SQL proxy is configured
- For EC2: Verify RDS security group allows EC2 security group

### CORS Errors

- Update `CORS_ORIGINS` environment variable
- Include protocol (http/https) in origins
- Ensure backend allows credentials if needed

### Build Failures

- Check Dockerfile syntax
- Verify all dependencies in requirements.txt/package.json
- Review build logs for specific errors

