#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import { DatabaseConnection } from '../database/connection';
import { DatabaseMigrator } from '../database/migrator';
import { getDatabaseConfig, validateConfig } from '../config/database';

// Load environment variables
dotenv.config();

async function runMigrations() {
  let db: DatabaseConnection | null = null;
  
  try {
    console.log('Starting database migration process...');
    
    // Validate configuration
    validateConfig();
    
    // Initialize database connection
    const dbConfig = getDatabaseConfig();
    db = DatabaseConnection.getInstance(dbConfig);
    
    // Test connection
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    
    // Create migrator and run migrations
    const migrator = new DatabaseMigrator(db);
    
    // Check migration status
    const status = await migrator.getMigrationStatus();
    console.log(`Found ${status.executed.length} executed migrations`);
    console.log(`Found ${status.pending.length} pending migrations`);
    
    if (status.pending.length === 0) {
      console.log('No pending migrations to run');
      return;
    }
    
    console.log('Pending migrations:');
    status.pending.forEach(migration => console.log(`  - ${migration}`));
    
    // Run pending migrations
    await migrator.runPendingMigrations();
    
    console.log('Migration process completed successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function rollbackMigration() {
  let db: DatabaseConnection | null = null;
  
  try {
    console.log('Starting migration rollback...');
    
    // Validate configuration
    validateConfig();
    
    // Initialize database connection
    const dbConfig = getDatabaseConfig();
    db = DatabaseConnection.getInstance(dbConfig);
    
    // Test connection
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    
    // Create migrator and rollback
    const migrator = new DatabaseMigrator(db);
    await migrator.rollbackLastMigration();
    
    console.log('Rollback completed successfully');
    
  } catch (error) {
    console.error('Rollback failed:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function showMigrationStatus() {
  let db: DatabaseConnection | null = null;
  
  try {
    // Validate configuration
    validateConfig();
    
    // Initialize database connection
    const dbConfig = getDatabaseConfig();
    db = DatabaseConnection.getInstance(dbConfig);
    
    // Test connection
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    
    // Create migrator and show status
    const migrator = new DatabaseMigrator(db);
    const status = await migrator.getMigrationStatus();
    
    console.log('\n=== Migration Status ===');
    console.log(`Executed migrations (${status.executed.length}):`);
    status.executed.forEach(migration => console.log(`  ✓ ${migration}`));
    
    console.log(`\nPending migrations (${status.pending.length}):`);
    status.pending.forEach(migration => console.log(`  - ${migration}`));
    
  } catch (error) {
    console.error('Failed to get migration status:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
  case 'up':
  case 'migrate':
    runMigrations();
    break;
  case 'down':
  case 'rollback':
    rollbackMigration();
    break;
  case 'status':
    showMigrationStatus();
    break;
  default:
    console.log('Usage: ts-node migrate.ts [up|down|status]');
    console.log('  up/migrate: Run pending migrations');
    console.log('  down/rollback: Rollback last migration');
    console.log('  status: Show migration status');
    process.exit(1);
}