import { Request, Response } from 'express';
import { PredictionService } from '../services/PredictionService';
import { CreatePredictionRequest, PredictionHistoryQuery } from '../types';
import CacheService from '../services/CacheService';

export class PredictionController {
  private cacheService: CacheService;

  constructor(private predictionService: PredictionService) {
    this.cacheService = new CacheService();
  }

  /**
   * POST /api/predictions/request
   * Create a new prediction request
   */
  public createPredictionRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const requestData: CreatePredictionRequest = req.body;
      const userId = (req as any).user?.id; // From auth middleware if available

      // Validate request data
      const validation = this.predictionService.validatePredictionRequest(requestData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.errors
        });
        return;
      }

      // Create prediction request
      const result = await this.predictionService.createPredictionRequest(requestData, userId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error
        });
        return;
      }

      // Start processing the prediction asynchronously
      const processingPromise = this.predictionService.processPredictionRequest(
        result.data!.id,
        req.body.propertyType || 'Condo'
      );

      // Don't await - let it process in background
      processingPromise.catch(error => {
        console.error(`Failed to process prediction request ${result.data!.id}:`, error);
      });

      res.status(201).json({
        success: true,
        data: {
          requestId: result.data!.id,
          areaId: result.data!.areaId,
          timeframeYears: result.data!.timeframeYears,
          status: 'processing',
          message: 'Prediction request created and processing started'
        }
      });

    } catch (error) {
      console.error('Error creating prediction request:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * GET /api/predictions/request/:requestId
   * Get prediction result by request ID
   */
  public getPredictionResult = async (req: Request, res: Response): Promise<void> => {
    try {
      const { requestId } = req.params;

      if (!requestId) {
        res.status(400).json({
          success: false,
          error: 'Request ID is required'
        });
        return;
      }

      // Check cache first
      const cachedResult = await this.cacheService.getCachedPredictionResult(requestId);
      if (cachedResult) {
        res.json({
          success: true,
          data: cachedResult
        });
        return;
      }

      const result = await this.predictionService.getPredictionByRequestId(requestId);

      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 : 400;
        res.status(statusCode).json({
          success: false,
          error: result.error
        });
        return;
      }

      // Cache the result for 2 hours
      if (result.data) {
        await this.cacheService.cachePredictionResult(result.data, 7200);
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error getting prediction result:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * POST /api/predictions/process/:requestId
   * Manually trigger prediction processing (for testing or retry)
   */
  public processPrediction = async (req: Request, res: Response): Promise<void> => {
    try {
      const { requestId } = req.params;
      const { propertyType = 'Condo' } = req.body;

      if (!requestId) {
        res.status(400).json({
          success: false,
          error: 'Request ID is required'
        });
        return;
      }

      const result = await this.predictionService.processPredictionRequest(requestId, propertyType);

      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 : 
                          result.error?.includes('timed out') ? 408 : 400;
        
        res.status(statusCode).json({
          success: false,
          error: result.error,
          processingTimeMs: result.processingTimeMs
        });
        return;
      }

      res.json({
        success: true,
        data: result.result,
        processingTimeMs: result.processingTimeMs
      });

    } catch (error) {
      console.error('Error processing prediction:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * GET /api/predictions/history
   * Get prediction history with optional filters
   */
  public getPredictionHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const query: PredictionHistoryQuery = {
        areaId: req.query.areaId as string,
        userId: req.query.userId as string || (req as any).user?.id,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };

      // Remove undefined values
      Object.keys(query).forEach(key => {
        if (query[key as keyof PredictionHistoryQuery] === undefined) {
          delete query[key as keyof PredictionHistoryQuery];
        }
      });

      const result = await this.predictionService.getPredictionHistory(query);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.json({
        success: true,
        data: result.data,
        count: result.data?.length || 0
      });

    } catch (error) {
      console.error('Error getting prediction history:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * GET /api/predictions/statistics/:areaId
   * Get prediction statistics for an area
   */
  public getPredictionStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { areaId } = req.params;

      if (!areaId) {
        res.status(400).json({
          success: false,
          error: 'Area ID is required'
        });
        return;
      }

      const result = await this.predictionService.getPredictionStatistics(areaId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error
        });
        return;
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Error getting prediction statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * GET /api/predictions/health
   * Get prediction service health status
   */
  public getHealthStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const health = await this.predictionService.getHealthStatus();
      
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('Error getting health status:', error);
      res.status(503).json({
        success: false,
        error: 'Health check failed',
        data: {
          status: 'unhealthy',
          checks: {
            database: false,
            historicalData: false,
            predictionModel: false
          },
          uptime: 0
        }
      });
    }
  };

  /**
   * POST /api/predictions/validate
   * Validate prediction request without creating it
   */
  public validatePredictionRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const requestData: CreatePredictionRequest = req.body;

      const validation = this.predictionService.validatePredictionRequest(requestData);

      res.json({
        success: true,
        data: {
          isValid: validation.isValid,
          errors: validation.errors
        }
      });

    } catch (error) {
      console.error('Error validating prediction request:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}