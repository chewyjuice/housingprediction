const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'postgres', // Connect to default database first
  user: 'postgres',
  password: 'postgres',
});

async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection...');
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL!');
    
    // Check if database exists
    const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = 'housing_predictor'");
    
    if (dbCheck.rows.length === 0) {
      console.log('Creating housing_predictor database...');
      await client.query('CREATE DATABASE housing_predictor');
      console.log('✅ Database created!');
    } else {
      console.log('✅ Database housing_predictor already exists!');
    }
    
    client.release();
    
    // Test connection to the housing_predictor database
    const appPool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'housing_predictor',
      user: 'postgres',
      password: 'postgres',
    });
    
    const appClient = await appPool.connect();
    console.log('✅ Connected to housing_predictor database!');
    
    const result = await appClient.query('SELECT NOW() as current_time');
    console.log('✅ Database query successful:', result.rows[0]);
    
    appClient.release();
    await appPool.end();
    await pool.end();
    
    console.log('\n🎉 Database setup complete!');
    console.log('Configuration:');
    console.log('  Host: localhost');
    console.log('  Port: 5432');
    console.log('  Database: housing_predictor');
    console.log('  Username: postgres');
    console.log('  Password: postgres');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();