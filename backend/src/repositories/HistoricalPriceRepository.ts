import { DatabaseConnection } from '../database/connection';
import { BaseRepositoryImpl } from './BaseRepository';
import { HistoricalPriceEntity } from '../types';

export interface IHistoricalPriceRepository {
  findById(id: string): Promise<HistoricalPriceEntity | null>;
  findAll(): Promise<HistoricalPriceEntity[]>;
  create(entity: Omit<HistoricalPriceEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<HistoricalPriceEntity>;
  update(id: string, updates: Partial<HistoricalPriceEntity>): Promise<HistoricalPriceEntity | null>;
  delete(id: string): Promise<boolean>;
  findByAreaId(areaId: string): Promise<HistoricalPriceEntity[]>;
  findByPropertyType(propertyType: 'HDB' | 'Condo' | 'Landed'): Promise<HistoricalPriceEntity[]>;
  findByAreaAndPropertyType(areaId: string, propertyType: 'HDB' | 'Condo' | 'Landed'): Promise<HistoricalPriceEntity[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<HistoricalPriceEntity[]>;
  getPriceHistory(areaId: string, propertyType?: 'HDB' | 'Condo' | 'Landed', years?: number): Promise<HistoricalPriceEntity[]>;
  getAveragePrices(areaId: string, propertyType?: 'HDB' | 'Condo' | 'Landed'): Promise<{
    avgPrice: number;
    avgPricePerSqft: number;
    recordCount: number;
  }>;
  getPriceTrends(areaId: string, months: number): Promise<{
    month: string;
    avgPrice: number;
    avgPricePerSqft: number;
    recordCount: number;
  }[]>;
}

export class HistoricalPriceRepository extends BaseRepositoryImpl<HistoricalPriceEntity> implements IHistoricalPriceRepository {
  constructor(db: DatabaseConnection) {
    super(db, 'historical_prices');
  }

  protected mapRowToEntity(row: any): HistoricalPriceEntity {
    return this.snakeToCamel(row) as HistoricalPriceEntity;
  }

  public async findByAreaId(areaId: string): Promise<HistoricalPriceEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1 
      ORDER BY record_date DESC
    `;
    
    const result = await this.executeQuery<HistoricalPriceEntity>(query, [areaId]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findByPropertyType(propertyType: 'HDB' | 'Condo' | 'Landed'): Promise<HistoricalPriceEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE property_type = $1 
      ORDER BY record_date DESC
    `;
    
    const result = await this.executeQuery<HistoricalPriceEntity>(query, [propertyType]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findByAreaAndPropertyType(
    areaId: string, 
    propertyType: 'HDB' | 'Condo' | 'Landed'
  ): Promise<HistoricalPriceEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1 AND property_type = $2 
      ORDER BY record_date DESC
    `;
    
    const result = await this.executeQuery<HistoricalPriceEntity>(query, [areaId, propertyType]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findByDateRange(startDate: Date, endDate: Date): Promise<HistoricalPriceEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE record_date BETWEEN $1 AND $2 
      ORDER BY record_date DESC
    `;
    
    const result = await this.executeQuery<HistoricalPriceEntity>(query, [startDate, endDate]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async getPriceHistory(
    areaId: string, 
    propertyType?: 'HDB' | 'Condo' | 'Landed', 
    years?: number
  ): Promise<HistoricalPriceEntity[]> {
    let query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1
    `;
    
    const params: any[] = [areaId];
    let paramIndex = 2;

    if (propertyType) {
      query += ` AND property_type = $${paramIndex}`;
      params.push(propertyType);
      paramIndex++;
    }

    if (years) {
      query += ` AND record_date >= CURRENT_DATE - INTERVAL '${years} years'`;
    }

    query += ` ORDER BY record_date DESC`;

    const result = await this.executeQuery<HistoricalPriceEntity>(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async getAveragePrices(
    areaId: string, 
    propertyType?: 'HDB' | 'Condo' | 'Landed'
  ): Promise<{
    avgPrice: number;
    avgPricePerSqft: number;
    recordCount: number;
  }> {
    let query = `
      SELECT 
        AVG(price) as avg_price,
        AVG(price_per_sqft) as avg_price_per_sqft,
        COUNT(*) as record_count
      FROM ${this.tableName} 
      WHERE area_id = $1
    `;
    
    const params: any[] = [areaId];

    if (propertyType) {
      query += ` AND property_type = $2`;
      params.push(propertyType);
    }

    const result = await this.executeQuery<{
      avg_price: number;
      avg_price_per_sqft: number;
      record_count: string;
    }>(query, params);

    const row = result.rows[0];

    return {
      avgPrice: parseFloat(row.avg_price?.toString() || '0'),
      avgPricePerSqft: parseFloat(row.avg_price_per_sqft?.toString() || '0'),
      recordCount: parseInt(row.record_count || '0')
    };
  }

  public async getPriceTrends(areaId: string, months: number): Promise<{
    month: string;
    avgPrice: number;
    avgPricePerSqft: number;
    recordCount: number;
  }[]> {
    const query = `
      SELECT 
        TO_CHAR(record_date, 'YYYY-MM') as month,
        AVG(price) as avg_price,
        AVG(price_per_sqft) as avg_price_per_sqft,
        COUNT(*) as record_count
      FROM ${this.tableName} 
      WHERE area_id = $1 
      AND record_date >= CURRENT_DATE - INTERVAL '${months} months'
      GROUP BY TO_CHAR(record_date, 'YYYY-MM')
      ORDER BY month DESC
    `;

    const result = await this.executeQuery<{
      month: string;
      avg_price: number;
      avg_price_per_sqft: number;
      record_count: string;
    }>(query, [areaId]);

    return result.rows.map(row => ({
      month: row.month,
      avgPrice: parseFloat(row.avg_price?.toString() || '0'),
      avgPricePerSqft: parseFloat(row.avg_price_per_sqft?.toString() || '0'),
      recordCount: parseInt(row.record_count)
    }));
  }

  public async getLatestPriceByArea(areaId: string, propertyType?: 'HDB' | 'Condo' | 'Landed'): Promise<HistoricalPriceEntity | null> {
    let query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1
    `;
    
    const params: any[] = [areaId];

    if (propertyType) {
      query += ` AND property_type = $2`;
      params.push(propertyType);
    }

    query += ` ORDER BY record_date DESC LIMIT 1`;

    const result = await this.executeQuery<HistoricalPriceEntity>(query, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  public async getPriceStatistics(areaId: string): Promise<{
    propertyType: 'HDB' | 'Condo' | 'Landed';
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    avgPricePerSqft: number;
    recordCount: number;
    latestDate: Date;
  }[]> {
    const query = `
      SELECT 
        property_type,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        AVG(price_per_sqft) as avg_price_per_sqft,
        COUNT(*) as record_count,
        MAX(record_date) as latest_date
      FROM ${this.tableName} 
      WHERE area_id = $1
      GROUP BY property_type
      ORDER BY property_type
    `;

    const result = await this.executeQuery<{
      property_type: 'HDB' | 'Condo' | 'Landed';
      avg_price: number;
      min_price: number;
      max_price: number;
      avg_price_per_sqft: number;
      record_count: string;
      latest_date: Date;
    }>(query, [areaId]);

    return result.rows.map(row => ({
      propertyType: row.property_type,
      avgPrice: parseFloat(row.avg_price?.toString() || '0'),
      minPrice: parseFloat(row.min_price?.toString() || '0'),
      maxPrice: parseFloat(row.max_price?.toString() || '0'),
      avgPricePerSqft: parseFloat(row.avg_price_per_sqft?.toString() || '0'),
      recordCount: parseInt(row.record_count),
      latestDate: row.latest_date
    }));
  }

  public async findDuplicatePrices(
    areaId: string, 
    recordDate: Date, 
    propertyType: 'HDB' | 'Condo' | 'Landed', 
    source: string
  ): Promise<HistoricalPriceEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1 
      AND record_date = $2 
      AND property_type = $3 
      AND source = $4
      ORDER BY created_at DESC
    `;
    
    const result = await this.executeQuery<HistoricalPriceEntity>(
      query, 
      [areaId, recordDate, propertyType, source]
    );
    
    return result.rows.map(row => this.mapRowToEntity(row));
  }
}