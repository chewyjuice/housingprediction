import { DatabaseConnection } from '../database/connection';
import { BaseRepositoryImpl } from './BaseRepository';
import { PredictionRequestEntity, PredictionResultEntity, PredictionHistoryQuery } from '../types';

export interface IPredictionRepository {
  // Prediction Request methods
  createRequest(entity: Omit<PredictionRequestEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<PredictionRequestEntity>;
  findRequestById(id: string): Promise<PredictionRequestEntity | null>;
  findRequestsByAreaId(areaId: string): Promise<PredictionRequestEntity[]>;
  findRequestsByUserId(userId: string): Promise<PredictionRequestEntity[]>;
  findRequestsInDateRange(startDate: Date, endDate: Date): Promise<PredictionRequestEntity[]>;
  
  // Prediction Result methods
  createResult(entity: Omit<PredictionResultEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<PredictionResultEntity>;
  findResultById(id: string): Promise<PredictionResultEntity | null>;
  findResultByRequestId(requestId: string): Promise<PredictionResultEntity | null>;
  findResultsByAreaId(areaId: string): Promise<PredictionResultEntity[]>;
  
  // Historical tracking methods
  getPredictionHistory(query: PredictionHistoryQuery): Promise<{
    request: PredictionRequestEntity;
    result: PredictionResultEntity;
  }[]>;
  getAccuracyMetrics(areaId: string, timeframeYears?: number): Promise<{
    totalPredictions: number;
    averageAccuracy: number;
    accuracyByTimeframe: { timeframe: number; accuracy: number; count: number }[];
  }>;
  findExpiredPredictions(): Promise<{
    request: PredictionRequestEntity;
    result: PredictionResultEntity;
  }[]>;
  
  // Analytics methods
  getPredictionTrends(areaId: string, months: number): Promise<{
    month: string;
    avgPredictedPrice: number;
    requestCount: number;
  }[]>;
}

export class PredictionRepository implements IPredictionRepository {
  private db: DatabaseConnection;
  private requestRepo: BaseRepositoryImpl<PredictionRequestEntity>;
  private resultRepo: BaseRepositoryImpl<PredictionResultEntity>;

  constructor(db: DatabaseConnection) {
    this.db = db;
    this.requestRepo = new PredictionRequestRepository(db);
    this.resultRepo = new PredictionResultRepository(db);
  }

  // Prediction Request methods
  public async createRequest(entity: Omit<PredictionRequestEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<PredictionRequestEntity> {
    return await this.requestRepo.create(entity);
  }

  public async findRequestById(id: string): Promise<PredictionRequestEntity | null> {
    return await this.requestRepo.findById(id);
  }

  public async findRequestsByAreaId(areaId: string): Promise<PredictionRequestEntity[]> {
    const query = `
      SELECT * FROM prediction_requests 
      WHERE area_id = $1 
      ORDER BY request_date DESC
    `;
    
    const result = await this.db.query<PredictionRequestEntity>(query, [areaId]);
    return result.rows.map(row => this.requestRepo['mapRowToEntity'](row));
  }

  public async findRequestsByUserId(userId: string): Promise<PredictionRequestEntity[]> {
    const query = `
      SELECT * FROM prediction_requests 
      WHERE user_id = $1 
      ORDER BY request_date DESC
    `;
    
    const result = await this.db.query<PredictionRequestEntity>(query, [userId]);
    return result.rows.map(row => this.requestRepo['mapRowToEntity'](row));
  }

  public async findRequestsInDateRange(startDate: Date, endDate: Date): Promise<PredictionRequestEntity[]> {
    const query = `
      SELECT * FROM prediction_requests 
      WHERE request_date BETWEEN $1 AND $2 
      ORDER BY request_date DESC
    `;
    
    const result = await this.db.query<PredictionRequestEntity>(query, [startDate, endDate]);
    return result.rows.map(row => this.requestRepo['mapRowToEntity'](row));
  }

  // Prediction Result methods
  public async createResult(entity: Omit<PredictionResultEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<PredictionResultEntity> {
    return await this.resultRepo.create(entity);
  }

  public async findResultById(id: string): Promise<PredictionResultEntity | null> {
    return await this.resultRepo.findById(id);
  }

  public async findResultByRequestId(requestId: string): Promise<PredictionResultEntity | null> {
    const query = `
      SELECT * FROM prediction_results 
      WHERE request_id = $1 
      LIMIT 1
    `;
    
    const result = await this.db.query<PredictionResultEntity>(query, [requestId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.resultRepo['mapRowToEntity'](result.rows[0]);
  }

  public async findResultsByAreaId(areaId: string): Promise<PredictionResultEntity[]> {
    const query = `
      SELECT pr.* FROM prediction_results pr
      JOIN prediction_requests req ON pr.request_id = req.id
      WHERE req.area_id = $1
      ORDER BY pr.generated_at DESC
    `;
    
    const result = await this.db.query<PredictionResultEntity>(query, [areaId]);
    return result.rows.map(row => this.resultRepo['mapRowToEntity'](row));
  }

  // Historical tracking methods
  public async getPredictionHistory(query: PredictionHistoryQuery): Promise<{
    request: PredictionRequestEntity;
    result: PredictionResultEntity;
  }[]> {
    let sqlQuery = `
      SELECT 
        req.*,
        res.*,
        req.id as request_id,
        res.id as result_id
      FROM prediction_requests req
      JOIN prediction_results res ON req.id = res.request_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (query.areaId) {
      sqlQuery += ` AND req.area_id = $${paramIndex}`;
      params.push(query.areaId);
      paramIndex++;
    }

    if (query.userId) {
      sqlQuery += ` AND req.user_id = $${paramIndex}`;
      params.push(query.userId);
      paramIndex++;
    }

    if (query.startDate) {
      sqlQuery += ` AND req.request_date >= $${paramIndex}`;
      params.push(query.startDate);
      paramIndex++;
    }

    if (query.endDate) {
      sqlQuery += ` AND req.request_date <= $${paramIndex}`;
      params.push(query.endDate);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY req.request_date DESC LIMIT 100`;

    const result = await this.db.query(sqlQuery, params);
    
    return result.rows.map(row => ({
      request: this.requestRepo['mapRowToEntity']({
        id: row.request_id,
        area_id: row.area_id,
        timeframe_years: row.timeframe_years,
        request_date: row.request_date,
        user_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at
      }),
      result: this.resultRepo['mapRowToEntity']({
        id: row.result_id,
        request_id: row.request_id,
        predicted_price: row.predicted_price,
        confidence_lower: row.confidence_lower,
        confidence_upper: row.confidence_upper,
        influencing_factors: row.influencing_factors,
        model_accuracy: row.model_accuracy,
        generated_at: row.generated_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      })
    }));
  }

  public async getAccuracyMetrics(areaId: string, timeframeYears?: number): Promise<{
    totalPredictions: number;
    averageAccuracy: number;
    accuracyByTimeframe: { timeframe: number; accuracy: number; count: number }[];
  }> {
    let baseQuery = `
      FROM prediction_requests req
      JOIN prediction_results res ON req.id = res.request_id
      WHERE req.area_id = $1
    `;
    
    const params: any[] = [areaId];
    let paramIndex = 2;

    if (timeframeYears) {
      baseQuery += ` AND req.timeframe_years = $${paramIndex}`;
      params.push(timeframeYears);
      paramIndex++;
    }

    // Get total predictions and average accuracy
    const totalQuery = `
      SELECT 
        COUNT(*) as total_predictions,
        AVG(res.model_accuracy) as average_accuracy
      ${baseQuery}
      AND res.model_accuracy IS NOT NULL
    `;

    const totalResult = await this.db.query<{
      total_predictions: string;
      average_accuracy: number;
    }>(totalQuery, params);

    // Get accuracy by timeframe
    const timeframeQuery = `
      SELECT 
        req.timeframe_years as timeframe,
        AVG(res.model_accuracy) as accuracy,
        COUNT(*) as count
      ${baseQuery}
      AND res.model_accuracy IS NOT NULL
      GROUP BY req.timeframe_years
      ORDER BY req.timeframe_years
    `;

    const timeframeResult = await this.db.query<{
      timeframe: number;
      accuracy: number;
      count: string;
    }>(timeframeQuery, params);

    const totalRow = totalResult.rows[0];

    return {
      totalPredictions: parseInt(totalRow.total_predictions || '0'),
      averageAccuracy: parseFloat(totalRow.average_accuracy?.toString() || '0'),
      accuracyByTimeframe: timeframeResult.rows.map(row => ({
        timeframe: row.timeframe,
        accuracy: parseFloat(row.accuracy?.toString() || '0'),
        count: parseInt(row.count)
      }))
    };
  }

  public async findExpiredPredictions(): Promise<{
    request: PredictionRequestEntity;
    result: PredictionResultEntity;
  }[]> {
    const query = `
      SELECT 
        req.*,
        res.*,
        req.id as request_id,
        res.id as result_id
      FROM prediction_requests req
      JOIN prediction_results res ON req.id = res.request_id
      WHERE req.request_date + INTERVAL '1 year' * req.timeframe_years <= CURRENT_DATE
      ORDER BY req.request_date DESC
    `;

    const result = await this.db.query(query);
    
    return result.rows.map(row => ({
      request: this.requestRepo['mapRowToEntity']({
        id: row.request_id,
        area_id: row.area_id,
        timeframe_years: row.timeframe_years,
        request_date: row.request_date,
        user_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at
      }),
      result: this.resultRepo['mapRowToEntity']({
        id: row.result_id,
        request_id: row.request_id,
        predicted_price: row.predicted_price,
        confidence_lower: row.confidence_lower,
        confidence_upper: row.confidence_upper,
        influencing_factors: row.influencing_factors,
        model_accuracy: row.model_accuracy,
        generated_at: row.generated_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      })
    }));
  }

  public async getPredictionTrends(areaId: string, months: number): Promise<{
    month: string;
    avgPredictedPrice: number;
    requestCount: number;
  }[]> {
    const query = `
      SELECT 
        TO_CHAR(req.request_date, 'YYYY-MM') as month,
        AVG(res.predicted_price) as avg_predicted_price,
        COUNT(*) as request_count
      FROM prediction_requests req
      JOIN prediction_results res ON req.id = res.request_id
      WHERE req.area_id = $1
      AND req.request_date >= CURRENT_DATE - INTERVAL '${months} months'
      GROUP BY TO_CHAR(req.request_date, 'YYYY-MM')
      ORDER BY month DESC
    `;

    const result = await this.db.query<{
      month: string;
      avg_predicted_price: number;
      request_count: string;
    }>(query, [areaId]);

    return result.rows.map(row => ({
      month: row.month,
      avgPredictedPrice: parseFloat(row.avg_predicted_price?.toString() || '0'),
      requestCount: parseInt(row.request_count)
    }));
  }
}

// Helper repository classes
class PredictionRequestRepository extends BaseRepositoryImpl<PredictionRequestEntity> {
  constructor(db: DatabaseConnection) {
    super(db, 'prediction_requests');
  }

  protected mapRowToEntity(row: any): PredictionRequestEntity {
    return this.snakeToCamel(row) as PredictionRequestEntity;
  }
}

class PredictionResultRepository extends BaseRepositoryImpl<PredictionResultEntity> {
  constructor(db: DatabaseConnection) {
    super(db, 'prediction_results');
  }

  protected mapRowToEntity(row: any): PredictionResultEntity {
    const entity = this.snakeToCamel(row) as PredictionResultEntity;
    
    // Parse JSON fields
    if (typeof entity.influencingFactors === 'string') {
      entity.influencingFactors = JSON.parse(entity.influencingFactors);
    }
    
    return entity;
  }
}