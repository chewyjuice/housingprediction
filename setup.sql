-- Create the housing_predictor database
DROP DATABASE IF EXISTS housing_predictor;
CREATE DATABASE housing_predictor;

-- Connect to the new database and create a test table
\c housing_predictor;

-- Create a simple test table to verify the database works
CREATE TABLE IF NOT EXISTS test_connection (
    id SERIAL PRIMARY KEY,
    message TEXT DEFAULT 'Database connection successful!',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a test record
INSERT INTO test_connection (message) VALUES ('PostgreSQL setup complete!');

-- Show the test record
SELECT * FROM test_connection;