#!/usr/bin/env pwsh

Write-Host "Setting up PostgreSQL database for Singapore Housing Predictor..." -ForegroundColor Green

# Set password environment variable
$env:PGPASSWORD = "postgres"

try {
    # Test connection to PostgreSQL
    Write-Host "Testing PostgreSQL connection..." -ForegroundColor Yellow
    $result = psql -U postgres -h localhost -d postgres -c "SELECT 1;" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL connection successful!" -ForegroundColor Green
        
        # Create database
        Write-Host "Creating housing_predictor database..." -ForegroundColor Yellow
        psql -U postgres -h localhost -d postgres -c "DROP DATABASE IF EXISTS housing_predictor;" 2>$null
        psql -U postgres -h localhost -d postgres -c "CREATE DATABASE housing_predictor;"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database 'housing_predictor' created successfully!" -ForegroundColor Green
            
            # Test connection to new database
            Write-Host "Testing connection to new database..." -ForegroundColor Yellow
            psql -U postgres -h localhost -d housing_predictor -c "SELECT 'Database ready!' as status;"
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Database setup complete!" -ForegroundColor Green
                Write-Host ""
                Write-Host "Database Configuration:" -ForegroundColor Cyan
                Write-Host "  Host: localhost" -ForegroundColor White
                Write-Host "  Port: 5432" -ForegroundColor White
                Write-Host "  Database: housing_predictor" -ForegroundColor White
                Write-Host "  Username: postgres" -ForegroundColor White
                Write-Host "  Password: postgres" -ForegroundColor White
            } else {
                Write-Host "❌ Failed to connect to new database" -ForegroundColor Red
            }
        } else {
            Write-Host "❌ Failed to create database" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Cannot connect to PostgreSQL. Error:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        Write-Host ""
        Write-Host "Possible solutions:" -ForegroundColor Yellow
        Write-Host "1. Make sure PostgreSQL service is running" -ForegroundColor White
        Write-Host "2. Check if password is 'postgres'" -ForegroundColor White
        Write-Host "3. Try connecting with pgAdmin first" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Error occurred: $($_.Exception.Message)" -ForegroundColor Red
}

# Clear password environment variable
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue