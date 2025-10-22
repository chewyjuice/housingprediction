@echo off
REM Singapore Housing Predictor - Production Deployment Script (Windows)
REM This script handles the deployment of the application to production

setlocal enabledelayedexpansion

REM Configuration
set COMPOSE_FILE=docker-compose.yml
set ENV_FILE=.env
set BACKUP_DIR=.\backups
set LOG_FILE=.\logs\deploy.log

REM Create necessary directories
if not exist logs mkdir logs
if not exist backups mkdir backups
if not exist ssl mkdir ssl

REM Functions for colored output
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

echo %BLUE%[%date% %time%]%NC% Starting Singapore Housing Predictor deployment...

REM Check prerequisites
echo %BLUE%[INFO]%NC% Checking prerequisites...

REM Check if Docker is installed and running
docker --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Docker is not installed. Please install Docker first.
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Docker is not running. Please start Docker first.
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo %RED%[ERROR]%NC% Docker Compose is not available. Please install Docker Compose.
        exit /b 1
    )
)

REM Check if environment file exists
if not exist "%ENV_FILE%" (
    echo %YELLOW%[WARNING]%NC% Environment file %ENV_FILE% not found.
    if exist ".env.production" (
        copy .env.production "%ENV_FILE%"
        echo %YELLOW%[WARNING]%NC% Please edit %ENV_FILE% with your production values before continuing.
        pause
    ) else (
        echo %RED%[ERROR]%NC% No environment template found. Please create %ENV_FILE% manually.
        exit /b 1
    )
)

echo %GREEN%[SUCCESS]%NC% Prerequisites check completed

REM Create backup
echo %BLUE%[INFO]%NC% Creating backup of existing data...

set BACKUP_TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_TIMESTAMP=%BACKUP_TIMESTAMP: =0%
set BACKUP_PATH=%BACKUP_DIR%\backup_%BACKUP_TIMESTAMP%

mkdir "%BACKUP_PATH%" 2>nul

REM Backup database if running
docker-compose ps postgres | findstr "Up" >nul 2>&1
if not errorlevel 1 (
    echo %BLUE%[INFO]%NC% Backing up PostgreSQL database...
    docker-compose exec -T postgres pg_dump -U postgres housing_predictor > "%BACKUP_PATH%\database.sql"
)

REM Backup Redis data if running
docker-compose ps redis | findstr "Up" >nul 2>&1
if not errorlevel 1 (
    echo %BLUE%[INFO]%NC% Backing up Redis data...
    docker-compose exec -T redis redis-cli BGSAVE
)

echo %GREEN%[SUCCESS]%NC% Backup completed: %BACKUP_PATH%

REM Build and deploy services
echo %BLUE%[INFO]%NC% Building and deploying services...

REM Pull latest images for base services
echo %BLUE%[INFO]%NC% Pulling base images...
docker-compose pull postgres redis nginx

REM Build application images
echo %BLUE%[INFO]%NC% Building application images...
docker-compose build --no-cache

REM Start services
echo %BLUE%[INFO]%NC% Starting services...
docker-compose up -d

REM Wait for services to be healthy
echo %BLUE%[INFO]%NC% Waiting for services to become healthy...

set /a max_attempts=30
set /a attempt=1

:health_check_loop
if !attempt! gtr !max_attempts! (
    echo %RED%[ERROR]%NC% Services failed to become healthy within timeout
    exit /b 1
)

echo %BLUE%[INFO]%NC% Health check attempt !attempt!/!max_attempts!...

REM Check backend health
curl -f http://localhost:8000/health >nul 2>&1
if not errorlevel 1 (
    echo %GREEN%[SUCCESS]%NC% Backend is healthy
) else (
    echo %YELLOW%[WARNING]%NC% Backend not ready yet...
    timeout /t 10 /nobreak >nul
    set /a attempt+=1
    goto health_check_loop
)

REM Check nginx health
curl -f http://localhost/health >nul 2>&1
if not errorlevel 1 (
    echo %GREEN%[SUCCESS]%NC% Nginx is healthy
    goto health_check_complete
) else (
    echo %YELLOW%[WARNING]%NC% Nginx not ready yet...
    timeout /t 10 /nobreak >nul
    set /a attempt+=1
    goto health_check_loop
)

:health_check_complete
echo %GREEN%[SUCCESS]%NC% All services are healthy and running

REM Run database migrations
echo %BLUE%[INFO]%NC% Running database migrations...
docker-compose exec -T backend npm run migrate
if errorlevel 1 (
    echo %RED%[ERROR]%NC% Database migration failed
    exit /b 1
)

echo %GREEN%[SUCCESS]%NC% Database migrations completed

REM Seed initial data
echo %BLUE%[INFO]%NC% Seeding initial data...
docker-compose exec -T backend npm run seed:areas

echo %GREEN%[SUCCESS]%NC% Data seeding completed

REM Verify deployment
echo %BLUE%[INFO]%NC% Verifying deployment...

REM Test API endpoints
curl -f http://localhost/health >nul 2>&1
if not errorlevel 1 (
    echo %GREEN%[SUCCESS]%NC% Health endpoint is working
) else (
    echo %RED%[ERROR]%NC% Health endpoint is not responding
    exit /b 1
)

curl -f http://localhost/api/areas/search >nul 2>&1
if not errorlevel 1 (
    echo %GREEN%[SUCCESS]%NC% Areas API is working
) else (
    echo %RED%[ERROR]%NC% Areas API is not responding
    exit /b 1
)

curl -f http://localhost/ >nul 2>&1
if not errorlevel 1 (
    echo %GREEN%[SUCCESS]%NC% Frontend is accessible
) else (
    echo %RED%[ERROR]%NC% Frontend is not accessible
    exit /b 1
)

echo %GREEN%[SUCCESS]%NC% Deployment verification completed

REM Cleanup
echo %BLUE%[INFO]%NC% Cleaning up old Docker images...
docker image prune -f

echo %GREEN%[SUCCESS]%NC% Cleanup completed

REM Show deployment status
echo.
echo %BLUE%[INFO]%NC% Deployment Status:
echo.
docker-compose ps
echo.
echo %BLUE%[INFO]%NC% Application URLs:
echo   Frontend: http://localhost/
echo   Backend API: http://localhost/api/
echo   Health Check: http://localhost/health
echo.
echo %BLUE%[INFO]%NC% Logs can be viewed with: docker-compose logs -f [service_name]
echo %BLUE%[INFO]%NC% To stop services: docker-compose down
echo %BLUE%[INFO]%NC% To view this status again: docker-compose ps

echo.
echo %GREEN%[SUCCESS]%NC% Deployment completed successfully!
echo %BLUE%[INFO]%NC% Singapore Housing Predictor is now running in production mode.

pause