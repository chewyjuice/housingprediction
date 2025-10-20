@echo off
echo Setting up PostgreSQL for Singapore Housing Predictor...

REM Check if PostgreSQL is running
psql -U postgres -c "SELECT version();" >nul 2>&1
if %errorlevel% equ 0 (
    echo PostgreSQL is already running!
    goto :create_db
)

echo Starting PostgreSQL service...
net start postgresql-x64-13 >nul 2>&1
if %errorlevel% neq 0 (
    echo Trying alternative service name...
    sc start "postgresql-x64-13" >nul 2>&1
)

REM Wait a moment for service to start
timeout /t 3 /nobreak >nul

:create_db
echo Creating database and user...
psql -U postgres -c "CREATE DATABASE housing_predictor;" 2>nul
psql -U postgres -c "CREATE USER housing_user WITH PASSWORD 'password';" 2>nul
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE housing_predictor TO housing_user;" 2>nul

echo Testing connection...
psql -U postgres -d housing_predictor -c "SELECT 'Database setup complete!' as status;"

echo.
echo PostgreSQL setup complete!
echo Database: housing_predictor
echo User: housing_user
echo Password: password
echo.
pause