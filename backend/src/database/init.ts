import { DatabaseConnection } from './connection';
import { DatabaseMigrator } from './migrator';
import { getDatabaseConfig, validateConfig } from '../config/database';

export async function initializeDatabase(): Promise<DatabaseConnection> {
  try {
    // Validate configuration
    validateConfig();
    
    // Get database configuration
    const dbConfig = getDatabaseConfig();
    
    // Initialize database connection
    const db = DatabaseConnection.getInstance(dbConfig);
    
    // Test connection
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    
    console.log('Database connection established successfully');
    
    // Run migrations
    const migrator = new DatabaseMigrator(db);
    await migrator.runPendingMigrations();
    
    console.log('Database initialization completed successfully');
    
    return db;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  try {
    const db = DatabaseConnection.getInstance();
    await db.close();
    console.log('Database connection closed successfully');
  } catch (error) {
    console.error('Error closing database connection:', error);
    throw error;
  }
}

export { DatabaseConnection, DatabaseMigrator };