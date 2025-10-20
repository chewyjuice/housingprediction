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