@echo off
set PGPASSWORD=postgres
echo Creating housing_predictor database...
psql -U postgres -h localhost -d postgres -c "DROP DATABASE IF EXISTS housing_predictor;"
psql -U postgres -h localhost -d postgres -c "CREATE DATABASE housing_predictor;"
echo Database created successfully!
pause