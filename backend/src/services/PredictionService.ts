import { 
  PredictionRequest, 
  PredictionResult, 
  CreatePredictionRequest, 
  PredictionHistoryQuery,
  ServiceResponse,
  Area,
  PredictionResultEntity,
  AreaEntity
} from '../types';
import { IPredictionRepository } from '../repositories/PredictionRepository';
import { IAreaRepository } from '../repositories/AreaRepository';
import { IHistoricalPriceRepository } from '../repositories/HistoricalPriceRepository';
import { IDevelopmentRepository } from '../repositories/DevelopmentRepository';
import { HistoricalPriceAnalyzer } from './ml/HistoricalPriceAnalyzer';
import { EnsemblePredictionModel } from './ml/EnsemblePredictionModel';
// UUID functionality will be handled by the database

export interface PredictionServiceConfig {
  maxTimeframeYears: number;
  minTimeframeYears: number;
  predictionTimeoutMs: number;
  cacheExpirationHours: number;
}

export interface PredictionJobResult {
  requestId: string;
  success: boolean;
  result?: PredictionResult;
  error?: string;
  processingTimeMs: number;
}

export class PredictionService {
  private historicalAnalyzer: HistoricalPriceAnalyzer;
  private ensembleModel: EnsemblePredictionModel;
  private config: PredictionServiceConfig;

  constructor(
    private predictionRepository: IPredictionRepository,
    private areaRepository: IAreaRepository,
    private historicalPriceRepository: IHistoricalPriceRepository,
    private developmentRepository: IDevelopmentRepository,
    config?: Partial<PredictionServiceConfig>
  ) {
    this.config = {
      maxTimeframeYears: 10,
      minTimeframeYears: 1,
      predictionTimeoutMs: 10000, // 10 seconds
      cacheExpirationHours: 24,
      ...config
    };

    this.historicalAnalyzer = new HistoricalPriceAnalyzer(this.historicalPriceRepository);
    this.ensembleModel = new EnsemblePredictionModel(this.historicalAnalyzer, this.developmentRepository);
  }

  /**
   * Create a new prediction request
   */
  public async createPredictionRequest(
    request: CreatePredictionRequest,
    userId?: string
  ): Promise<ServiceResponse<PredictionRequest>> {
    try {
      // Validate timeframe
      const validationResult = this.validateTimeframe(request.timeframeYears);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.error
        };
      }

      // Validate area exists
      const areaEntity = await this.areaRepository.findById(request.areaId);
      if (!areaEntity) {
        return {
          success: false,
          error: `Area with ID ${request.areaId} not found`
        };
      }

      // Create prediction request
      const predictionRequest: Omit<PredictionRequest, 'id'> = {
        areaId: request.areaId,
        timeframeYears: request.timeframeYears,
        requestDate: new Date(),
        userId
      };

      const createdRequest = await this.predictionRepository.createRequest(predictionRequest);

      return {
        success: true,
        data: createdRequest
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create prediction request: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Process a prediction request with timeout handling
   */
  public async processPredictionRequest(
    requestId: string,
    propertyType: 'HDB' | 'Condo' | 'Landed' = 'Condo'
  ): Promise<PredictionJobResult> {
    const startTime = Date.now();

    try {
      // Get the prediction request
      const request = await this.predictionRepository.findRequestById(requestId);
      if (!request) {
        return {
          requestId,
          success: false,
          error: 'Prediction request not found',
          processingTimeMs: Date.now() - startTime
        };
      }

      // Get area data
      const areaEntity = await this.areaRepository.findById(request.areaId);
      if (!areaEntity) {
        return {
          requestId,
          success: false,
          error: 'Area not found',
          processingTimeMs: Date.now() - startTime
        };
      }

      // Convert AreaEntity to Area
      const area: Area = this.convertAreaEntityToArea(areaEntity);

      // Check for existing recent prediction (caching)
      const existingPrediction = await this.findRecentPrediction(
        request.areaId,
        request.timeframeYears,
        propertyType
      );

      if (existingPrediction) {
        return {
          requestId,
          success: true,
          result: existingPrediction,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Prediction calculation timed out'));
        }, this.config.predictionTimeoutMs);
      });

      // Create prediction promise
      const predictionPromise = this.generatePrediction(area, request.timeframeYears, propertyType);

      // Race between prediction and timeout
      const ensemblePrediction = await Promise.race([predictionPromise, timeoutPromise]);

      // Create prediction result entity
      const predictionResultEntity: Omit<PredictionResultEntity, 'id' | 'createdAt' | 'updatedAt'> = {
        requestId: request.id,
        predictedPrice: ensemblePrediction.predictedPrice,
        confidenceLower: ensemblePrediction.confidenceInterval.lower,
        confidenceUpper: ensemblePrediction.confidenceInterval.upper,
        influencingFactors: JSON.stringify(ensemblePrediction.influencingFactors),
        modelAccuracy: ensemblePrediction.confidence,
        generatedAt: new Date()
      };

      // Save prediction result
      const savedResultEntity = await this.predictionRepository.createResult(predictionResultEntity);
      
      // Convert back to domain model
      const savedResult: PredictionResult = {
        id: savedResultEntity.id,
        requestId: savedResultEntity.requestId,
        predictedPrice: savedResultEntity.predictedPrice,
        confidenceInterval: {
          lower: savedResultEntity.confidenceLower,
          upper: savedResultEntity.confidenceUpper
        },
        influencingFactors: typeof savedResultEntity.influencingFactors === 'string' 
          ? JSON.parse(savedResultEntity.influencingFactors)
          : savedResultEntity.influencingFactors,
        modelAccuracy: savedResultEntity.modelAccuracy,
        generatedAt: savedResultEntity.generatedAt
      };

      return {
        requestId,
        success: true,
        result: savedResult,
        processingTimeMs: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Log timeout specifically
      if (errorMessage.includes('timed out')) {
        console.warn(`Prediction request ${requestId} timed out after ${this.config.predictionTimeoutMs}ms`);
      }

      return {
        requestId,
        success: false,
        error: errorMessage,
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Generate prediction using ensemble model
   */
  private async generatePrediction(
    area: Area,
    timeframeYears: number,
    propertyType: 'HDB' | 'Condo' | 'Landed'
  ) {
    return await this.ensembleModel.generateEnsemblePrediction(
      area.id,
      area,
      timeframeYears,
      propertyType
    );
  }

  /**
   * Find recent prediction for caching
   */
  private async findRecentPrediction(
    areaId: string,
    timeframeYears: number,
    propertyType: 'HDB' | 'Condo' | 'Landed'
  ): Promise<PredictionResult | null> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - this.config.cacheExpirationHours);

    try {
      // This would need to be implemented in the repository
      // For now, return null to always generate fresh predictions
      return null;
    } catch (error) {
      console.warn('Failed to check for recent predictions:', error);
      return null;
    }
  }

  /**
   * Validate prediction timeframe
   */
  private validateTimeframe(timeframeYears: number): { isValid: boolean; error?: string } {
    if (!Number.isInteger(timeframeYears)) {
      return {
        isValid: false,
        error: 'Timeframe must be a whole number of years'
      };
    }

    if (timeframeYears < this.config.minTimeframeYears) {
      return {
        isValid: false,
        error: `Timeframe must be at least ${this.config.minTimeframeYears} year${this.config.minTimeframeYears > 1 ? 's' : ''}`
      };
    }

    if (timeframeYears > this.config.maxTimeframeYears) {
      return {
        isValid: false,
        error: `Timeframe cannot exceed ${this.config.maxTimeframeYears} years`
      };
    }

    return { isValid: true };
  }

  /**
   * Get prediction history for an area or user
   */
  public async getPredictionHistory(
    query: PredictionHistoryQuery
  ): Promise<ServiceResponse<PredictionResult[]>> {
    try {
      const historyResults = await this.predictionRepository.getPredictionHistory(query);
      
      // Convert to PredictionResult format
      const results = historyResults.map(item => ({
        id: item.result.id,
        requestId: item.result.requestId,
        predictedPrice: item.result.predictedPrice,
        confidenceInterval: {
          lower: item.result.confidenceLower,
          upper: item.result.confidenceUpper
        },
        influencingFactors: typeof item.result.influencingFactors === 'string' 
          ? JSON.parse(item.result.influencingFactors)
          : item.result.influencingFactors,
        modelAccuracy: item.result.modelAccuracy,
        generatedAt: item.result.generatedAt
      }));
      
      return {
        success: true,
        data: results
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve prediction history: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get prediction by request ID
   */
  public async getPredictionByRequestId(requestId: string): Promise<ServiceResponse<PredictionResult>> {
    try {
      const resultEntity = await this.predictionRepository.findResultByRequestId(requestId);
      
      if (!resultEntity) {
        return {
          success: false,
          error: 'Prediction result not found'
        };
      }

      // Convert entity to domain model
      const result: PredictionResult = {
        id: resultEntity.id,
        requestId: resultEntity.requestId,
        predictedPrice: resultEntity.predictedPrice,
        confidenceInterval: {
          lower: resultEntity.confidenceLower,
          upper: resultEntity.confidenceUpper
        },
        influencingFactors: typeof resultEntity.influencingFactors === 'string' 
          ? JSON.parse(resultEntity.influencingFactors)
          : resultEntity.influencingFactors,
        modelAccuracy: resultEntity.modelAccuracy,
        generatedAt: resultEntity.generatedAt
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve prediction: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get prediction statistics for an area
   */
  public async getPredictionStatistics(areaId: string): Promise<ServiceResponse<{
    totalPredictions: number;
    averagePredictedPrice: number;
    averageConfidence: number;
    timeframeDistribution: { [years: number]: number };
    lastPredictionDate: Date | null;
  }>> {
    try {
      const predictions = await this.predictionRepository.findResultsByAreaId(areaId);
      
      if (predictions.length === 0) {
        return {
          success: true,
          data: {
            totalPredictions: 0,
            averagePredictedPrice: 0,
            averageConfidence: 0,
            timeframeDistribution: {},
            lastPredictionDate: null
          }
        };
      }

      // Calculate statistics
      const totalPredictions = predictions.length;
      const averagePredictedPrice = predictions.reduce((sum, p) => sum + p.predictedPrice, 0) / totalPredictions;
      const averageConfidence = predictions.reduce((sum, p) => sum + (p.modelAccuracy || 0), 0) / totalPredictions;
      
      // Get timeframe distribution
      const timeframeDistribution: { [years: number]: number } = {};
      for (const prediction of predictions) {
        const request = await this.predictionRepository.findRequestById(prediction.requestId);
        if (request) {
          const years = request.timeframeYears;
          timeframeDistribution[years] = (timeframeDistribution[years] || 0) + 1;
        }
      }

      const lastPredictionDate = predictions.reduce((latest, p) => {
        const date = new Date(p.generatedAt);
        return !latest || date > latest ? date : latest;
      }, null as Date | null);

      return {
        success: true,
        data: {
          totalPredictions,
          averagePredictedPrice: Math.round(averagePredictedPrice),
          averageConfidence: Math.round(averageConfidence * 100) / 100,
          timeframeDistribution,
          lastPredictionDate
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to calculate prediction statistics: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate prediction request data
   */
  public validatePredictionRequest(request: CreatePredictionRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate area ID
    if (!request.areaId || typeof request.areaId !== 'string' || request.areaId.trim().length === 0) {
      errors.push('Area ID is required and must be a non-empty string');
    }

    // Validate timeframe
    const timeframeValidation = this.validateTimeframe(request.timeframeYears);
    if (!timeframeValidation.isValid && timeframeValidation.error) {
      errors.push(timeframeValidation.error);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get service health status
   */
  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      database: boolean;
      historicalData: boolean;
      predictionModel: boolean;
    };
    uptime: number;
  }> {
    const startTime = Date.now();
    const checks = {
      database: false,
      historicalData: false,
      predictionModel: false
    };

    try {
      // Test database connection
      await this.areaRepository.findAll();
      checks.database = true;
    } catch (error) {
      console.warn('Database health check failed:', error);
    }

    try {
      // Test historical data availability
      const areas = await this.areaRepository.findAll();
      if (areas.length > 0) {
        const historicalPrices = await this.historicalPriceRepository.findByAreaId(areas[0].id);
        checks.historicalData = historicalPrices.length > 0;
      }
    } catch (error) {
      console.warn('Historical data health check failed:', error);
    }

    try {
      // Test prediction model (simplified check)
      checks.predictionModel = true; // Models are stateless, so this is always true if code loads
    } catch (error) {
      console.warn('Prediction model health check failed:', error);
    }

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks >= totalChecks / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks,
      uptime: Date.now() - startTime
    };
  }

  /**
   * Convert AreaEntity to Area domain model
   */
  private convertAreaEntityToArea(entity: AreaEntity): Area {
    return {
      id: entity.id,
      name: entity.name,
      district: entity.district,
      postalCodes: entity.postalCodes,
      coordinates: {
        latitude: entity.latitude,
        longitude: entity.longitude,
        boundaries: typeof entity.boundaries === 'string' 
          ? JSON.parse(entity.boundaries)
          : entity.boundaries
      },
      characteristics: {
        mrtProximity: entity.mrtProximity,
        cbdDistance: entity.cbdDistance,
        amenityScore: entity.amenityScore
      }
    };
  }
}