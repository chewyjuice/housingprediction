import fs from 'fs/promises';
import path from 'path';
import { DatabaseConnection } from './connection';

export class DatabaseMigrator {
  private db: DatabaseConnection;
  private migrationsPath: string;

  constructor(db: DatabaseConnection, migrationsPath?: string) {
    this.db = db;
    this.migrationsPath = migrationsPath || path.join(__dirname, 'migrations');
  }

  public async createMigrationsTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await this.db.query(createTableQuery);
    console.log('Migrations table created or already exists');
  }

  public async getExecutedMigrations(): Promise<string[]> {
    const result = await this.db.query<{ filename: string }>(
      'SELECT filename FROM migrations ORDER BY id'
    );
    return result.rows.map(row => row.filename);
  }

  public async getMigrationFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      console.error('Error reading migrations directory:', error);
      return [];
    }
  }

  public async executeMigration(filename: string): Promise<void> {
    const filePath = path.join(this.migrationsPath, filename);
    
    try {
      const migrationSQL = await fs.readFile(filePath, 'utf-8');
      
      await this.db.transaction(async (client) => {
        // Execute the migration SQL
        await client.query(migrationSQL);
        
        // Record the migration as executed
        await client.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [filename]
        );
      });
      
      console.log(`Migration executed successfully: ${filename}`);
    } catch (error) {
      console.error(`Error executing migration ${filename}:`, error);
      throw error;
    }
  }

  public async runPendingMigrations(): Promise<void> {
    console.log('Starting database migrations...');
    
    // Ensure migrations table exists
    await this.createMigrationsTable();
    
    // Get executed and available migrations
    const executedMigrations = await this.getExecutedMigrations();
    const availableMigrations = await this.getMigrationFiles();
    
    // Find pending migrations
    const pendingMigrations = availableMigrations.filter(
      migration => !executedMigrations.includes(migration)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations found');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migrations`);
    
    // Execute pending migrations
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }
    
    console.log('All migrations completed successfully');
  }

  public async rollbackLastMigration(): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations();
    
    if (executedMigrations.length === 0) {
      console.log('No migrations to rollback');
      return;
    }
    
    const lastMigration = executedMigrations[executedMigrations.length - 1];
    
    await this.db.transaction(async (client) => {
      // Remove migration record
      await client.query(
        'DELETE FROM migrations WHERE filename = $1',
        [lastMigration]
      );
    });
    
    console.log(`Rolled back migration: ${lastMigration}`);
    console.log('Note: This only removes the migration record. Manual cleanup of schema changes may be required.');
  }

  public async getMigrationStatus(): Promise<{ executed: string[]; pending: string[] }> {
    const executedMigrations = await this.getExecutedMigrations();
    const availableMigrations = await this.getMigrationFiles();
    const pendingMigrations = availableMigrations.filter(
      migration => !executedMigrations.includes(migration)
    );
    
    return {
      executed: executedMigrations,
      pending: pendingMigrations
    };
  }
}

export default DatabaseMigrator;