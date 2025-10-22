# Singapore Housing Predictor - Production Deployment Guide

This guide covers the deployment of the Singapore Housing Predictor application in a production environment.

## Prerequisites

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+ recommended) or Windows 10/11 with WSL2
- **Memory**: Minimum 8GB RAM (16GB recommended)
- **Storage**: Minimum 50GB free space
- **CPU**: 4+ cores recommended

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git
- curl (for health checks)

### Network Requirements
- Ports 80 and 443 available for web traffic
- Outbound internet access for web crawling
- Access to PostgreSQL and Redis ports (if using external services)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd singapore-housing-predictor
```

### 2. Configure Environment

```bash
# Copy the production environment template
cp .env.production .env

# Edit the environment file with your production values
nano .env
```

**Important**: Update the following values in `.env`:
- `POSTGRES_PASSWORD`: Strong database password
- `REDIS_PASSWORD`: Strong Redis password  
- `JWT_SECRET`: Secure JWT secret (32+ characters)
- `REACT_APP_API_URL`: Your domain URL
- `FRONTEND_URL`: Your domain URL

### 3. Deploy

**Linux/macOS:**
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**Windows:**
```cmd
scripts\deploy.bat
```

### 4. Verify Deployment

After deployment, verify the services are running:

```bash
# Check service status
docker-compose ps

# Test health endpoints
curl http://localhost/health
curl http://localhost/api/areas/search
```

## Manual Deployment Steps

If you prefer to deploy manually or need to troubleshoot:

### 1. Environment Setup

```bash
# Create necessary directories
mkdir -p logs backups ssl monitoring/grafana/dashboards

# Set up environment file
cp .env.production .env
# Edit .env with your values
```

### 2. Build and Start Services

```bash
# Pull base images
docker-compose pull postgres redis nginx

# Build application images
docker-compose build --no-cache

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 3. Database Setup

```bash
# Run migrations
docker-compose exec backend npm run migrate

# Seed initial data
docker-compose exec backend npm run seed:areas
```

### 4. Health Checks

```bash
# Wait for services to be healthy
docker-compose exec backend curl -f http://localhost:8000/health
docker-compose exec ml-service curl -f http://localhost:8001/health
curl -f http://localhost/health
```

## SSL/HTTPS Configuration

### 1. Obtain SSL Certificates

**Option A: Let's Encrypt (Recommended)**
```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Obtain certificates
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./ssl/key.pem
sudo chown $USER:$USER ./ssl/*.pem
```

**Option B: Self-Signed (Development)**
```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./ssl/key.pem \
  -out ./ssl/cert.pem \
  -subj "/C=SG/ST=Singapore/L=Singapore/O=Housing Predictor/CN=localhost"
```

### 2. Enable HTTPS in Nginx

Edit `nginx.conf` and uncomment the SSL configuration sections:

```nginx
# Uncomment these lines:
listen 443 ssl http2;
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;
# ... other SSL settings
```

### 3. Update Environment Variables

```bash
# Update .env file
REACT_APP_API_URL=https://your-domain.com/api
FRONTEND_URL=https://your-domain.com
```

### 4. Restart Services

```bash
docker-compose restart nginx
```

## Monitoring Setup

### 1. Deploy Monitoring Stack

```bash
# Start monitoring services
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Access monitoring dashboards
echo "Prometheus: http://localhost:9090"
echo "Grafana: http://localhost:3001 (admin/admin)"
echo "Kibana: http://localhost:5601"
```

### 2. Configure Grafana

1. Access Grafana at `http://localhost:3001`
2. Login with `admin/admin` (change password on first login)
3. Add Prometheus data source: `http://prometheus:9090`
4. Import dashboards from `monitoring/grafana/dashboards/`

## Backup and Recovery

### 1. Automated Backups

The deployment script automatically creates backups before deployment. Manual backup:

```bash
# Create backup directory
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database
docker-compose exec -T postgres pg_dump -U postgres housing_predictor > "$BACKUP_DIR/database.sql"

# Backup Redis
docker-compose exec -T redis redis-cli BGSAVE
docker cp $(docker-compose ps -q redis):/data/dump.rdb "$BACKUP_DIR/redis.rdb"

# Backup ML models
docker run --rm -v singapore-housing-predictor_ml_models:/source -v "$PWD/$BACKUP_DIR":/backup alpine tar czf /backup/ml_models.tar.gz -C /source .
```

### 2. Restore from Backup

```bash
# Stop services
docker-compose down

# Restore database
docker-compose up -d postgres
sleep 10
cat backups/backup_YYYYMMDD_HHMMSS/database.sql | docker-compose exec -T postgres psql -U postgres housing_predictor

# Restore Redis
docker cp backups/backup_YYYYMMDD_HHMMSS/redis.rdb $(docker-compose ps -q redis):/data/dump.rdb
docker-compose restart redis

# Restore ML models
docker run --rm -v singapore-housing-predictor_ml_models:/target -v "$PWD/backups/backup_YYYYMMDD_HHMMSS":/backup alpine tar xzf /backup/ml_models.tar.gz -C /target

# Start all services
docker-compose up -d
```

## Scaling and Performance

### 1. Horizontal Scaling

```yaml
# In docker-compose.yml, scale services:
backend:
  deploy:
    replicas: 3
    
ml-service:
  deploy:
    replicas: 2
```

### 2. Load Balancing

Update nginx configuration to load balance across multiple backend instances:

```nginx
upstream backend {
    server backend_1:8000;
    server backend_2:8000;
    server backend_3:8000;
}
```

### 3. Database Optimization

```bash
# Monitor database performance
docker-compose exec backend npm run db:analyze

# Optimize queries
docker-compose exec backend npm run db:optimize
```

## Troubleshooting

### Common Issues

**1. Services Not Starting**
```bash
# Check logs
docker-compose logs [service_name]

# Check resource usage
docker stats

# Restart specific service
docker-compose restart [service_name]
```

**2. Database Connection Issues**
```bash
# Check database status
docker-compose exec postgres pg_isready -U postgres

# Reset database connection
docker-compose restart backend
```

**3. High Memory Usage**
```bash
# Check memory usage
docker stats

# Restart services to free memory
docker-compose restart
```

**4. SSL Certificate Issues**
```bash
# Check certificate validity
openssl x509 -in ./ssl/cert.pem -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew
```

### Health Check Endpoints

- **Overall Health**: `http://localhost/health`
- **Backend API**: `http://localhost/api/health`
- **ML Service**: `http://localhost:8001/health`
- **Database**: `docker-compose exec postgres pg_isready`
- **Redis**: `docker-compose exec redis redis-cli ping`

### Log Locations

- **Application Logs**: `docker-compose logs [service_name]`
- **Nginx Logs**: `docker-compose exec nginx tail -f /var/log/nginx/access.log`
- **System Logs**: `./logs/deploy.log`

## Security Considerations

### 1. Environment Variables
- Use strong, unique passwords
- Never commit `.env` files to version control
- Rotate secrets regularly

### 2. Network Security
- Use HTTPS in production
- Configure firewall rules
- Limit database access to application services only

### 3. Container Security
- Keep base images updated
- Run containers as non-root users
- Use Docker secrets for sensitive data

### 4. Application Security
- Enable rate limiting
- Configure CORS properly
- Use secure headers (already configured in nginx)

## Maintenance

### 1. Regular Updates

```bash
# Update base images
docker-compose pull

# Rebuild application images
docker-compose build --no-cache

# Deploy updates
./scripts/deploy.sh
```

### 2. Log Rotation

```bash
# Configure log rotation for Docker
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### 3. Database Maintenance

```bash
# Run database maintenance
docker-compose exec backend npm run db:maintenance

# Vacuum and analyze
docker-compose exec postgres psql -U postgres -d housing_predictor -c "VACUUM ANALYZE;"
```

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review application logs: `docker-compose logs`
3. Check system resources: `docker stats`
4. Verify network connectivity and DNS resolution

## Performance Monitoring

Access the monitoring dashboards:
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
- **Kibana**: http://localhost:5601

Key metrics to monitor:
- Response times
- Error rates
- Database performance
- Memory and CPU usage
- Disk space
- Network traffic