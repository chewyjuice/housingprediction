#!/bin/bash

# Singapore Housing Predictor - Production Deployment Script
# This script handles the deployment of the application to production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy.log"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Create necessary directories
mkdir -p logs backups ssl

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker first."
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not available. Please install Docker Compose."
    fi
    
    # Check if environment file exists
    if [ ! -f "$ENV_FILE" ]; then
        warning "Environment file $ENV_FILE not found. Creating from template..."
        if [ -f ".env.production" ]; then
            cp .env.production "$ENV_FILE"
            warning "Please edit $ENV_FILE with your production values before continuing."
            read -p "Press Enter to continue after editing the environment file..."
        else
            error "No environment template found. Please create $ENV_FILE manually."
        fi
    fi
    
    success "Prerequisites check completed"
}

# Backup existing data
backup_data() {
    log "Creating backup of existing data..."
    
    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/backup_$BACKUP_TIMESTAMP"
    
    mkdir -p "$BACKUP_PATH"
    
    # Backup database if running
    if docker-compose ps postgres | grep -q "Up"; then
        log "Backing up PostgreSQL database..."
        docker-compose exec -T postgres pg_dump -U postgres housing_predictor > "$BACKUP_PATH/database.sql" || warning "Database backup failed"
    fi
    
    # Backup Redis data if running
    if docker-compose ps redis | grep -q "Up"; then
        log "Backing up Redis data..."
        docker-compose exec -T redis redis-cli BGSAVE || warning "Redis backup failed"
        docker cp $(docker-compose ps -q redis):/data/dump.rdb "$BACKUP_PATH/redis.rdb" || warning "Redis backup copy failed"
    fi
    
    # Backup ML models if they exist
    if docker volume ls | grep -q "ml_models"; then
        log "Backing up ML models..."
        docker run --rm -v singapore-housing-predictor_ml_models:/source -v "$PWD/$BACKUP_PATH":/backup alpine tar czf /backup/ml_models.tar.gz -C /source . || warning "ML models backup failed"
    fi
    
    success "Backup completed: $BACKUP_PATH"
}

# Build and deploy services
deploy_services() {
    log "Building and deploying services..."
    
    # Pull latest images for base services
    log "Pulling base images..."
    docker-compose pull postgres redis nginx
    
    # Build application images
    log "Building application images..."
    docker-compose build --no-cache
    
    # Start services with health checks
    log "Starting services..."
    docker-compose up -d
    
    # Wait for services to be healthy
    log "Waiting for services to become healthy..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Health check attempt $attempt/$max_attempts..."
        
        # Check database health
        if docker-compose exec -T postgres pg_isready -U postgres -d housing_predictor &> /dev/null; then
            success "Database is healthy"
        else
            warning "Database not ready yet..."
        fi
        
        # Check Redis health
        if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
            success "Redis is healthy"
        else
            warning "Redis not ready yet..."
        fi
        
        # Check backend health
        if curl -f http://localhost:8000/health &> /dev/null; then
            success "Backend is healthy"
        else
            warning "Backend not ready yet..."
        fi
        
        # Check frontend health
        if curl -f http://localhost:3000/ &> /dev/null; then
            success "Frontend is healthy"
        else
            warning "Frontend not ready yet..."
        fi
        
        # Check nginx health
        if curl -f http://localhost/health &> /dev/null; then
            success "Nginx is healthy"
            break
        else
            warning "Nginx not ready yet..."
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            error "Services failed to become healthy within timeout"
        fi
        
        sleep 10
        ((attempt++))
    done
    
    success "All services are healthy and running"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    docker-compose exec -T backend npm run migrate || error "Database migration failed"
    
    success "Database migrations completed"
}

# Seed initial data
seed_data() {
    log "Seeding initial data..."
    
    # Seed Singapore areas data
    docker-compose exec -T backend npm run seed:areas || warning "Area seeding failed"
    
    success "Data seeding completed"
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Test API endpoints
    log "Testing API endpoints..."
    
    # Health check
    if curl -f http://localhost/health &> /dev/null; then
        success "Health endpoint is working"
    else
        error "Health endpoint is not responding"
    fi
    
    # Areas API
    if curl -f http://localhost/api/areas/search &> /dev/null; then
        success "Areas API is working"
    else
        error "Areas API is not responding"
    fi
    
    # Frontend
    if curl -f http://localhost/ &> /dev/null; then
        success "Frontend is accessible"
    else
        error "Frontend is not accessible"
    fi
    
    success "Deployment verification completed"
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo ""
    docker-compose ps
    echo ""
    log "Application URLs:"
    log "  Frontend: http://localhost/"
    log "  Backend API: http://localhost/api/"
    log "  Health Check: http://localhost/health"
    echo ""
    log "Logs can be viewed with: docker-compose logs -f [service_name]"
    log "To stop services: docker-compose down"
    log "To view this status again: docker-compose ps"
}

# Cleanup old images and containers
cleanup() {
    log "Cleaning up old Docker images and containers..."
    
    # Remove old images
    docker image prune -f
    
    # Remove unused volumes (be careful with this in production)
    # docker volume prune -f
    
    success "Cleanup completed"
}

# Main deployment process
main() {
    log "Starting Singapore Housing Predictor deployment..."
    
    # Parse command line arguments
    SKIP_BACKUP=false
    SKIP_MIGRATIONS=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --skip-migrations)
                SKIP_MIGRATIONS=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-backup      Skip data backup"
                echo "  --skip-migrations  Skip database migrations"
                echo "  --help            Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Run deployment steps
    check_prerequisites
    
    if [ "$SKIP_BACKUP" = false ]; then
        backup_data
    else
        warning "Skipping backup as requested"
    fi
    
    deploy_services
    
    if [ "$SKIP_MIGRATIONS" = false ]; then
        run_migrations
        seed_data
    else
        warning "Skipping migrations as requested"
    fi
    
    verify_deployment
    cleanup
    show_status
    
    success "Deployment completed successfully!"
    log "Singapore Housing Predictor is now running in production mode."
}

# Run main function
main "$@"