import { Pool, PoolClient, QueryResult } from 'pg';
import { DatabaseConfig } from '../types';

export class DatabaseConnection {
  private pool: Pool;
  private static instance: DatabaseConnection;

  private constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 25, // Increased maximum number of clients in the pool
      min: 5, // Minimum number of clients to keep in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 3000, // Return an error after 3 seconds if connection could not be established
      maxUses: 7500, // Close (and replace) a connection after it has been used 7500 times
      acquireTimeoutMillis: 60000, // Maximum time to wait for a connection
      allowExitOnIdle: false, // Keep the pool alive
    });

    // Enhanced pool event handling
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', (client) => {
      console.log('New client connected to database');
      // Set session-level optimizations
      client.query(`
        SET statement_timeout = '30s';
        SET lock_timeout = '10s';
        SET idle_in_transaction_session_timeout = '60s';
      `).catch(err => console.warn('Failed to set session optimizations:', err));
    });

    this.pool.on('acquire', () => {
      console.log('Client acquired from pool');
    });

    this.pool.on('remove', () => {
      console.log('Client removed from pool');
    });
  }

  public static getInstance(config?: DatabaseConfig): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      if (!config) {
        throw new Error('Database configuration is required for first initialization');
      }
      DatabaseConnection.instance = new DatabaseConnection(config);
    }
    return DatabaseConnection.instance;
  }

  public async query<T extends Record<string, any> = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries (> 1 second)
      if (duration > 1000) {
        console.warn('Slow query detected', { 
          text: text.substring(0, 100) + '...', 
          duration, 
          rows: result.rowCount,
          poolInfo: this.getPoolInfo()
        });
      } else if (process.env.NODE_ENV === 'development') {
        console.log('Query executed', { 
          text: text.substring(0, 50) + '...', 
          duration, 
          rows: result.rowCount 
        });
      }
      
      return result;
    } catch (error) {
      console.error('Database query error', { 
        text: text.substring(0, 100) + '...', 
        params: params?.length, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  public async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('Database connection test successful:', result.rows[0]);
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    console.log('Database connection pool closed');
  }

  public getPoolInfo() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxConnections: 25,
      minConnections: 5,
    };
  }

  public async getPerformanceMetrics(): Promise<{
    activeConnections: number;
    totalQueries: number;
    slowQueries: number;
    avgQueryTime: number;
    cacheHitRatio: number;
    indexUsage: any[];
  }> {
    try {
      const [
        connectionStats,
        queryStats,
        cacheStats,
        indexStats
      ] = await Promise.all([
        this.query(`
          SELECT count(*) as active_connections 
          FROM pg_stat_activity 
          WHERE state = 'active' AND datname = current_database()
        `),
        this.query(`
          SELECT 
            sum(calls) as total_queries,
            sum(CASE WHEN mean_exec_time > 1000 THEN calls ELSE 0 END) as slow_queries,
            avg(mean_exec_time) as avg_query_time
          FROM pg_stat_statements 
          WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
        `),
        this.query(`
          SELECT 
            sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
          FROM pg_statio_user_tables
        `),
        this.query(`
          SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch
          FROM pg_stat_user_indexes 
          ORDER BY idx_scan DESC 
          LIMIT 10
        `)
      ]);

      return {
        activeConnections: parseInt(connectionStats.rows[0]?.active_connections || '0'),
        totalQueries: parseInt(queryStats.rows[0]?.total_queries || '0'),
        slowQueries: parseInt(queryStats.rows[0]?.slow_queries || '0'),
        avgQueryTime: parseFloat(queryStats.rows[0]?.avg_query_time || '0'),
        cacheHitRatio: parseFloat(cacheStats.rows[0]?.cache_hit_ratio || '0'),
        indexUsage: indexStats.rows
      };
    } catch (error) {
      console.warn('Failed to get performance metrics:', error);
      return {
        activeConnections: 0,
        totalQueries: 0,
        slowQueries: 0,
        avgQueryTime: 0,
        cacheHitRatio: 0,
        indexUsage: []
      };
    }
  }
}

export default DatabaseConnection;