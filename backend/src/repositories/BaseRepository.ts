import { PoolClient, QueryResult } from 'pg';
import { DatabaseConnection } from '../database/connection';
import { BaseRepository } from '../types';

export abstract class BaseRepositoryImpl<T extends { id: string; createdAt: Date; updatedAt: Date }> 
  implements BaseRepository<T> {
  
  protected db: DatabaseConnection;
  protected tableName: string;

  constructor(db: DatabaseConnection, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  public async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await this.db.query<T>(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  public async findAll(limit?: number, offset?: number): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`;
    const params: any[] = [];
    
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    
    if (offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(offset);
    }
    
    const result = await this.db.query<T>(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const columns = Object.keys(entity);
    const values = Object.values(entity);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await this.db.query<T>(query, values);
    return this.mapRowToEntity(result.rows[0]);
  }

  public async update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T | null> {
    const columns = Object.keys(updates);
    const values = Object.values(updates);
    
    if (columns.length === 0) {
      return this.findById(id);
    }
    
    const setClause = columns.map((col, index) => `${col} = $${index + 2}`).join(', ');
    const query = `
      UPDATE ${this.tableName} 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.db.query<T>(query, [id, ...values]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  public async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await this.db.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  public async count(whereClause?: string, params?: any[]): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    
    const result = await this.db.query<{ count: string }>(query, params);
    return parseInt(result.rows[0].count);
  }

  public async exists(id: string): Promise<boolean> {
    const query = `SELECT 1 FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
    const result = await this.db.query(query, [id]);
    return result.rows.length > 0;
  }

  protected async executeQuery<R extends Record<string, any> = any>(query: string, params?: any[]): Promise<QueryResult<R>> {
    return await this.db.query<R>(query, params);
  }

  protected async executeTransaction<R>(callback: (client: PoolClient) => Promise<R>): Promise<R> {
    return await this.db.transaction(callback);
  }

  // Query optimization methods
  protected async executeOptimizedQuery<R extends Record<string, any> = any>(
    query: string, 
    params?: any[],
    options?: {
      useIndex?: string;
      forceSeqScan?: boolean;
      enableHashJoin?: boolean;
    }
  ): Promise<QueryResult<R>> {
    let optimizedQuery = query;
    
    if (options?.forceSeqScan) {
      optimizedQuery = `SET enable_seqscan = off; ${optimizedQuery}; SET enable_seqscan = on;`;
    }
    
    if (options?.enableHashJoin === false) {
      optimizedQuery = `SET enable_hashjoin = off; ${optimizedQuery}; SET enable_hashjoin = on;`;
    }
    
    if (options?.useIndex) {
      // Add index hint as comment for query analysis
      optimizedQuery = `/* USE INDEX ${options.useIndex} */ ${optimizedQuery}`;
    }
    
    return await this.db.query<R>(optimizedQuery, params);
  }

  // Batch operations for better performance
  public async batchCreate(entities: Array<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T[]> {
    if (entities.length === 0) return [];
    
    const columns = Object.keys(entities[0]);
    const values = entities.map((entity, index) => {
      const entityValues = Object.values(entity);
      const placeholders = entityValues.map((_, valueIndex) => 
        `$${index * entityValues.length + valueIndex + 1}`
      ).join(', ');
      return `(${placeholders})`;
    }).join(', ');
    
    const allValues = entities.flatMap(entity => Object.values(entity));
    
    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES ${values}
      RETURNING *
    `;
    
    const result = await this.db.query<T>(query, allValues);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // Optimized pagination with cursor-based approach
  public async findPaginated(
    cursor?: string,
    limit: number = 20,
    orderBy: string = 'created_at',
    direction: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{
    data: T[];
    nextCursor?: string;
    hasMore: boolean;
  }> {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];
    
    if (cursor) {
      const operator = direction === 'DESC' ? '<' : '>';
      query += ` WHERE ${orderBy} ${operator} $1`;
      params.push(cursor);
    }
    
    query += ` ORDER BY ${orderBy} ${direction} LIMIT $${params.length + 1}`;
    params.push(limit + 1); // Fetch one extra to check if there are more
    
    const result = await this.executeOptimizedQuery<T>(query, params);
    const rows = result.rows.map(row => this.mapRowToEntity(row));
    
    const hasMore = rows.length > limit;
    if (hasMore) {
      rows.pop(); // Remove the extra row
    }
    
    const nextCursor = hasMore && rows.length > 0 
      ? (rows[rows.length - 1] as any)[orderBy]
      : undefined;
    
    return {
      data: rows,
      nextCursor,
      hasMore
    };
  }

  // Bulk update with optimized query
  public async bulkUpdate(
    updates: Array<{ id: string; data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>> }>
  ): Promise<T[]> {
    if (updates.length === 0) return [];
    
    // Use CASE statements for bulk updates
    const columns = Object.keys(updates[0].data);
    const setClauses = columns.map(column => {
      const cases = updates.map((update, index) => 
        `WHEN id = $${index * 2 + 1} THEN $${index * 2 + 2}`
      ).join(' ');
      return `${column} = CASE ${cases} ELSE ${column} END`;
    }).join(', ');
    
    const ids = updates.map(update => update.id);
    const values = updates.flatMap(update => [update.id, ...Object.values(update.data)]);
    
    const query = `
      UPDATE ${this.tableName}
      SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($${values.length + 1})
      RETURNING *
    `;
    
    const result = await this.db.query<T>(query, [...values, ids]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // Cache-aware find method
  protected async findWithCache<R>(
    cacheKey: string,
    queryFn: () => Promise<R>,
    ttlSeconds: number = 300
  ): Promise<R> {
    // This would integrate with Redis cache if available
    // For now, just execute the query directly
    return await queryFn();
  }

  // Query performance analysis
  public async analyzeQuery(query: string, params?: any[]): Promise<{
    executionTime: number;
    planningTime: number;
    plan: any;
  }> {
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
    const start = Date.now();
    const result = await this.db.query(explainQuery, params);
    const executionTime = Date.now() - start;
    
    const plan = result.rows[0]['QUERY PLAN'][0];
    
    return {
      executionTime,
      planningTime: plan['Planning Time'] || 0,
      plan: plan.Plan
    };
  }

  // Abstract method to be implemented by concrete repositories
  protected abstract mapRowToEntity(row: any): T;

  // Helper method to convert snake_case to camelCase
  protected snakeToCamel(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.snakeToCamel(item));
    }
    
    if (typeof obj === 'object') {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        converted[camelKey] = this.snakeToCamel(value);
      }
      return converted;
    }
    
    return obj;
  }

  // Helper method to convert camelCase to snake_case
  protected camelToSnake(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.camelToSnake(item));
    }
    
    if (typeof obj === 'object') {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        converted[snakeKey] = this.camelToSnake(value);
      }
      return converted;
    }
    
    return obj;
  }
}