import { DatabaseConnection } from '../database/connection';
import { BaseRepositoryImpl } from './BaseRepository';
import { DevelopmentEntity } from '../types';

export interface IDevelopmentRepository {
  findById(id: string): Promise<DevelopmentEntity | null>;
  findAll(): Promise<DevelopmentEntity[]>;
  create(entity: Omit<DevelopmentEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<DevelopmentEntity>;
  update(id: string, updates: Partial<DevelopmentEntity>): Promise<DevelopmentEntity | null>;
  delete(id: string): Promise<boolean>;
  findByAreaId(areaId: string): Promise<DevelopmentEntity[]>;
  findByType(type: 'school' | 'infrastructure' | 'shopping' | 'business'): Promise<DevelopmentEntity[]>;
  findByAreaAndType(areaId: string, type: 'school' | 'infrastructure' | 'shopping' | 'business'): Promise<DevelopmentEntity[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<DevelopmentEntity[]>;
  findByImpactScore(minScore: number): Promise<DevelopmentEntity[]>;
  findRecentDevelopments(areaId: string, monthsBack: number): Promise<DevelopmentEntity[]>;
  searchByKeywords(keywords: string[]): Promise<DevelopmentEntity[]>;
  findBySourcePublisher(publisher: string): Promise<DevelopmentEntity[]>;
  getTopImpactDevelopments(areaId: string, limit: number): Promise<DevelopmentEntity[]>;
  findDuplicateDevelopments(areaId: string, title: string, sourceUrl: string): Promise<DevelopmentEntity[]>;
}

export class DevelopmentRepository extends BaseRepositoryImpl<DevelopmentEntity> implements IDevelopmentRepository {
  constructor(db: DatabaseConnection) {
    super(db, 'developments');
  }

  protected mapRowToEntity(row: any): DevelopmentEntity {
    return this.snakeToCamel(row) as DevelopmentEntity;
  }

  public async findByAreaId(areaId: string): Promise<DevelopmentEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1 
      ORDER BY date_announced DESC, impact_score DESC
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [areaId]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findByType(type: 'school' | 'infrastructure' | 'shopping' | 'business'): Promise<DevelopmentEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE type = $1 
      ORDER BY date_announced DESC, impact_score DESC
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [type]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findByAreaAndType(
    areaId: string, 
    type: 'school' | 'infrastructure' | 'shopping' | 'business'
  ): Promise<DevelopmentEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1 AND type = $2 
      ORDER BY date_announced DESC, impact_score DESC
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [areaId, type]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findByDateRange(startDate: Date, endDate: Date): Promise<DevelopmentEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE date_announced BETWEEN $1 AND $2 
      ORDER BY date_announced DESC, impact_score DESC
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [startDate, endDate]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findByImpactScore(minScore: number): Promise<DevelopmentEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE impact_score >= $1 
      ORDER BY impact_score DESC, date_announced DESC
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [minScore]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findRecentDevelopments(areaId: string, monthsBack: number): Promise<DevelopmentEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1 
      AND date_announced >= CURRENT_DATE - INTERVAL '${monthsBack} months'
      ORDER BY date_announced DESC, impact_score DESC
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [areaId]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async searchByKeywords(keywords: string[]): Promise<DevelopmentEntity[]> {
    const keywordConditions = keywords.map((_, index) => 
      `(to_tsvector('english', title || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $${index + 1}))`
    ).join(' OR ');
    
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE ${keywordConditions}
      ORDER BY impact_score DESC, date_announced DESC
      LIMIT 100
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, keywords);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findBySourcePublisher(publisher: string): Promise<DevelopmentEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE source_publisher = $1 
      ORDER BY source_publish_date DESC
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [publisher]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async getTopImpactDevelopments(areaId: string, limit: number): Promise<DevelopmentEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1 
      ORDER BY impact_score DESC, date_announced DESC
      LIMIT $2
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [areaId, limit]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async getDevelopmentsByTypeAndArea(areaId: string): Promise<{ [key: string]: DevelopmentEntity[] }> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1 
      ORDER BY type, impact_score DESC, date_announced DESC
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [areaId]);
    const developments = result.rows.map(row => this.mapRowToEntity(row));
    
    // Group by type
    const grouped: { [key: string]: DevelopmentEntity[] } = {
      school: [],
      infrastructure: [],
      shopping: [],
      business: []
    };
    
    developments.forEach(dev => {
      if (grouped[dev.type]) {
        grouped[dev.type].push(dev);
      }
    });
    
    return grouped;
  }

  public async getImpactScoreStatistics(areaId?: string): Promise<{
    avgScore: number;
    maxScore: number;
    minScore: number;
    totalDevelopments: number;
  }> {
    let query = `
      SELECT 
        AVG(impact_score) as avg_score,
        MAX(impact_score) as max_score,
        MIN(impact_score) as min_score,
        COUNT(*) as total_developments
      FROM ${this.tableName}
    `;
    
    const params: any[] = [];
    
    if (areaId) {
      query += ' WHERE area_id = $1';
      params.push(areaId);
    }
    
    const result = await this.executeQuery<{
      avg_score: number;
      max_score: number;
      min_score: number;
      total_developments: string;
    }>(query, params);
    
    const row = result.rows[0];
    
    return {
      avgScore: parseFloat(row.avg_score?.toString() || '0'),
      maxScore: parseFloat(row.max_score?.toString() || '0'),
      minScore: parseFloat(row.min_score?.toString() || '0'),
      totalDevelopments: parseInt(row.total_developments || '0')
    };
  }

  public async findDuplicateDevelopments(areaId: string, title: string, sourceUrl: string): Promise<DevelopmentEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1 AND (title = $2 OR source_url = $3)
      ORDER BY created_at DESC
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [areaId, title, sourceUrl]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async getMonthlyDevelopmentCounts(areaId: string, months: number): Promise<{
    month: string;
    count: number;
    avgImpactScore: number;
  }[]> {
    const query = `
      SELECT 
        TO_CHAR(date_announced, 'YYYY-MM') as month,
        COUNT(*) as count,
        AVG(impact_score) as avg_impact_score
      FROM ${this.tableName} 
      WHERE area_id = $1 
      AND date_announced >= CURRENT_DATE - INTERVAL '${months} months'
      GROUP BY TO_CHAR(date_announced, 'YYYY-MM')
      ORDER BY month DESC
    `;
    
    const result = await this.executeQuery<{
      month: string;
      count: string;
      avg_impact_score: number;
    }>(query, [areaId]);
    
    return result.rows.map(row => ({
      month: row.month,
      count: parseInt(row.count),
      avgImpactScore: parseFloat(row.avg_impact_score?.toString() || '0')
    }));
  }
}  // Opt
imized method using covering indexes for recent developments
  public async findRecentDevelopmentsOptimized(areaId: string, monthsBack: number = 12): Promise<DevelopmentEntity[]> {
    const query = `
      SELECT id, area_id, type, title, impact_score, date_announced, expected_completion,
             source_url, source_publisher, source_publish_date, created_at, updated_at
      FROM ${this.tableName} 
      WHERE area_id = $1 
        AND date_announced >= CURRENT_DATE - INTERVAL '${monthsBack} months'
      ORDER BY date_announced DESC, impact_score DESC
      LIMIT 50
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [areaId]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // Optimized method for high-impact developments using partial index
  public async findHighImpactDevelopments(areaId: string, minImpactScore: number = 5.0): Promise<DevelopmentEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE area_id = $1 
        AND impact_score >= $2
      ORDER BY impact_score DESC, date_announced DESC
      LIMIT 20
    `;
    
    const result = await this.executeQuery<DevelopmentEntity>(query, [areaId, minImpactScore]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // Optimized method for development impact analysis using composite index
  public async getDevelopmentImpactAnalysis(areaId: string): Promise<{
    totalDevelopments: number;
    averageImpactScore: number;
    developmentsByType: Array<{
      type: string;
      count: number;
      avgImpactScore: number;
      totalImpactScore: number;
    }>;
    recentHighImpact: DevelopmentEntity[];
  }> {
    const [totalResult, typeResult, recentResult] = await Promise.all([
      this.executeQuery(`
        SELECT 
          COUNT(*) as total_developments,
          AVG(impact_score) as avg_impact_score
        FROM ${this.tableName} 
        WHERE area_id = $1
      `, [areaId]),
      
      this.executeQuery(`
        SELECT 
          type,
          COUNT(*) as count,
          AVG(impact_score) as avg_impact_score,
          SUM(impact_score) as total_impact_score
        FROM ${this.tableName} 
        WHERE area_id = $1
        GROUP BY type
        ORDER BY total_impact_score DESC
      `, [areaId]),
      
      this.findHighImpactDevelopments(areaId, 5.0)
    ]);

    return {
      totalDevelopments: parseInt(totalResult.rows[0]?.total_developments || '0'),
      averageImpactScore: parseFloat(totalResult.rows[0]?.avg_impact_score || '0'),
      developmentsByType: typeResult.rows.map(row => ({
        type: row.type,
        count: parseInt(row.count),
        avgImpactScore: parseFloat(row.avg_impact_score),
        totalImpactScore: parseFloat(row.total_impact_score)
      })),
      recentHighImpact: recentResult
    };
  }

  // Batch insert method for better performance when inserting multiple developments
  public async batchInsert(developments: Array<Omit<DevelopmentEntity, 'id' | 'createdAt' | 'updatedAt'>>): Promise<DevelopmentEntity[]> {
    if (developments.length === 0) return [];

    const values = developments.map((_, index) => {
      const baseIndex = index * 10;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10})`;
    }).join(', ');

    const params = developments.flatMap(dev => [
      dev.areaId,
      dev.type,
      dev.title,
      dev.description,
      dev.impactScore,
      dev.dateAnnounced,
      dev.expectedCompletion,
      dev.sourceUrl,
      dev.sourcePublisher,
      dev.sourcePublishDate
    ]);

    const query = `
      INSERT INTO ${this.tableName} (
        area_id, type, title, description, impact_score, 
        date_announced, expected_completion, source_url, 
        source_publisher, source_publish_date
      ) VALUES ${values}
      ON CONFLICT (area_id, title, source_url) DO UPDATE SET
        description = EXCLUDED.description,
        impact_score = EXCLUDED.impact_score,
        expected_completion = EXCLUDED.expected_completion,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await this.executeQuery<DevelopmentEntity>(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // Method to get developments that need cache invalidation
  public async getDevelopmentsForCacheInvalidation(areaId: string, since: Date): Promise<string[]> {
    const query = `
      SELECT DISTINCT area_id
      FROM ${this.tableName} 
      WHERE area_id = $1 
        AND updated_at >= $2
    `;
    
    const result = await this.executeQuery<{ areaId: string }>(query, [areaId, since]);
    return result.rows.map(row => row.areaId);
  }
}