// Simple PostgreSQL connection test
console.log('Starting PostgreSQL connection test...');

const { exec } = require('child_process');

// Test 1: Check if PostgreSQL is running
exec('psql --version', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ PostgreSQL not found in PATH');
    return;
  }
  console.log('✅ PostgreSQL found:', stdout.trim());
  
  // Test 2: Try to connect
  process.env.PGPASSWORD = 'postgres';
  exec('psql -U postgres -h localhost -d postgres -c "SELECT 1;"', (error, stdout, stderr) => {
    if (error) {
      console.log('❌ Connection failed:', stderr);
      console.log('Trying to start PostgreSQL service...');
      
      // Try to start service
      exec('net start postgresql-x64-13', (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Could not start service:', stderr);
          console.log('\n🔧 Manual steps needed:');
          console.log('1. Open Services (services.msc)');
          console.log('2. Find PostgreSQL service');
          console.log('3. Start the service');
          console.log('4. Set password to "postgres"');
        } else {
          console.log('✅ Service started:', stdout);
        }
      });
    } else {
      console.log('✅ PostgreSQL connection successful!');
      
      // Test 3: Create database
      exec('psql -U postgres -h localhost -d postgres -c "CREATE DATABASE housing_predictor;"', (error, stdout, stderr) => {
        if (error && !stderr.includes('already exists')) {
          console.log('❌ Database creation failed:', stderr);
        } else {
          console.log('✅ Database housing_predictor ready!');
          console.log('\n🎉 PostgreSQL setup complete!');
          console.log('You can now restart your backend server.');
        }
      });
    }
  });
});