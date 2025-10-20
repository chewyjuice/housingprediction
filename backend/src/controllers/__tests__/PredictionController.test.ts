import { Request, Response } from 'express';
import { PredictionController } from '../PredictionController';
import { PredictionService } from '../../services/PredictionService';
import { CreatePredictionRequest, PredictionResult } from '../../types';

// Mock the PredictionService
const mockPredictionService = {
  createPredictionRequest: jest.fn(),
  processPredictionRequest: jest.fn(),
  getPredictionByRequestId: jest.fn(),
  getPredictionHistory: jest.fn(),
  getPredictionStatistics: jest.fn(),
  getHealthStatus: jest.fn(),
  validatePredictionRequest: jest.fn(),
} as unknown as jest.Mocked<PredictionService>;

describe('PredictionController', () => {
  let controller: PredictionController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new PredictionController(mockPredictionService);
    
    mockRequest = {
      body: {},
      params: {},
      query: {},
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    jest.clearAllMocks();
  });

  describe('createPredictionRequest', () => {
    const validRequestData: CreatePredictionRequest = {
      areaId: 'area-1',
      timeframeYears: 5,
    };

    const mockPredictionRequest = {
      id: 'req-1',
      areaId: 'area-1',
      timeframeYears: 5,
      requestDate: new Date(),
      userId: 'user-1',
    };

    it('should create prediction request successfully', async () => {
      mockRequest.body = validRequestData;
      mockPredictionService.validatePredictionRequest.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockPredictionService.createPredictionRequest.mockResolvedValue({
        success: true,
        data: mockPredictionRequest,
      });

      await controller.createPredictionRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          requestId: 'req-1',
          areaId: 'area-1',
          timeframeYears: 5,
          status: 'processing',
          message: 'Prediction request created and processing started',
        },
      });
    });

    it('should return validation errors', async () => {
      mockRequest.body = { areaId: '', timeframeYears: 15 };
      mockPredictionService.validatePredictionRequest.mockReturnValue({
        isValid: false,
        errors: ['Area ID is required', 'Timeframe cannot exceed 10 years'],
      });

      await controller.createPredictionRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid request data',
        details: ['Area ID is required', 'Timeframe cannot exceed 10 years'],
      });
    });

    it('should handle service errors', async () => {
      mockRequest.body = validRequestData;
      mockPredictionService.validatePredictionRequest.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockPredictionService.createPredictionRequest.mockResolvedValue({
        success: false,
        error: 'Area not found',
      });

      await controller.createPredictionRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Area not found',
      });
    });

    it('should handle internal server errors', async () => {
      mockRequest.body = validRequestData;
      mockPredictionService.validatePredictionRequest.mockImplementation(() => {
        throw new Error('Internal error');
      });

      await controller.createPredictionRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
      });
    });
  });

  describe('getPredictionResult', () => {
    const mockPredictionResult: PredictionResult = {
      id: 'res-1',
      requestId: 'req-1',
      predictedPrice: 950000,
      confidenceInterval: {
        lower: 900000,
        upper: 1000000,
      },
      influencingFactors: [
        {
          developmentId: 'dev-1',
          impactWeight: 0.3,
          description: 'New MRT station development',
        },
      ],
      modelAccuracy: 0.85,
      generatedAt: new Date(),
    };

    it('should return prediction result successfully', async () => {
      mockRequest.params = { requestId: 'req-1' };
      mockPredictionService.getPredictionByRequestId.mockResolvedValue({
        success: true,
        data: mockPredictionResult,
      });

      await controller.getPredictionResult(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockPredictionResult,
      });
    });

    it('should return 404 when prediction not found', async () => {
      mockRequest.params = { requestId: 'nonexistent' };
      mockPredictionService.getPredictionByRequestId.mockResolvedValue({
        success: false,
        error: 'Prediction result not found',
      });

      await controller.getPredictionResult(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Prediction result not found',
      });
    });

    it('should return 400 when request ID is missing', async () => {
      mockRequest.params = {};

      await controller.getPredictionResult(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Request ID is required',
      });
    });
  });

  describe('processPrediction', () => {
    const mockJobResult = {
      requestId: 'req-1',
      success: true,
      result: {
        id: 'res-1',
        requestId: 'req-1',
        predictedPrice: 950000,
        confidenceInterval: { lower: 900000, upper: 1000000 },
        influencingFactors: [],
        modelAccuracy: 0.85,
        generatedAt: new Date(),
      },
      processingTimeMs: 1500,
    };

    it('should process prediction successfully', async () => {
      mockRequest.params = { requestId: 'req-1' };
      mockRequest.body = { propertyType: 'Condo' };
      mockPredictionService.processPredictionRequest.mockResolvedValue(mockJobResult);

      await controller.processPrediction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockJobResult.result,
        processingTimeMs: 1500,
      });
    });

    it('should handle processing timeout', async () => {
      mockRequest.params = { requestId: 'req-1' };
      mockRequest.body = {};
      mockPredictionService.processPredictionRequest.mockResolvedValue({
        requestId: 'req-1',
        success: false,
        error: 'Prediction calculation timed out',
        processingTimeMs: 10000,
      });

      await controller.processPrediction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(408);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Prediction calculation timed out',
        processingTimeMs: 10000,
      });
    });

    it('should handle request not found', async () => {
      mockRequest.params = { requestId: 'nonexistent' };
      mockRequest.body = {};
      mockPredictionService.processPredictionRequest.mockResolvedValue({
        requestId: 'nonexistent',
        success: false,
        error: 'Prediction request not found',
        processingTimeMs: 50,
      });

      await controller.processPrediction(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Prediction request not found',
        processingTimeMs: 50,
      });
    });

    it('should use default property type when not specified', async () => {
      mockRequest.params = { requestId: 'req-1' };
      mockRequest.body = {};
      mockPredictionService.processPredictionRequest.mockResolvedValue(mockJobResult);

      await controller.processPrediction(mockRequest as Request, mockResponse as Response);

      expect(mockPredictionService.processPredictionRequest).toHaveBeenCalledWith('req-1', 'Condo');
    });
  });

  describe('getPredictionHistory', () => {
    const mockHistoryResults = [
      {
        id: 'res-1',
        requestId: 'req-1',
        predictedPrice: 950000,
        confidenceInterval: { lower: 900000, upper: 1000000 },
        influencingFactors: [],
        modelAccuracy: 0.85,
        generatedAt: new Date(),
      },
    ];

    it('should return prediction history successfully', async () => {
      mockRequest.query = { areaId: 'area-1', userId: 'user-1' };
      mockPredictionService.getPredictionHistory.mockResolvedValue({
        success: true,
        data: mockHistoryResults,
      });

      await controller.getPredictionHistory(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockHistoryResults,
        count: 1,
      });
    });

    it('should handle date filters', async () => {
      mockRequest.query = {
        areaId: 'area-1',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };
      mockPredictionService.getPredictionHistory.mockResolvedValue({
        success: true,
        data: mockHistoryResults,
      });

      await controller.getPredictionHistory(mockRequest as Request, mockResponse as Response);

      expect(mockPredictionService.getPredictionHistory).toHaveBeenCalledWith({
        areaId: 'area-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });
    });

    it('should handle empty history', async () => {
      mockRequest.query = { areaId: 'area-1' };
      mockPredictionService.getPredictionHistory.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getPredictionHistory(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        count: 0,
      });
    });
  });

  describe('getPredictionStatistics', () => {
    const mockStatistics = {
      totalPredictions: 25,
      averagePredictedPrice: 950000,
      averageConfidence: 0.82,
      timeframeDistribution: { 1: 5, 3: 10, 5: 8, 10: 2 },
      lastPredictionDate: new Date('2024-01-15'),
    };

    it('should return prediction statistics successfully', async () => {
      mockRequest.params = { areaId: 'area-1' };
      mockPredictionService.getPredictionStatistics.mockResolvedValue({
        success: true,
        data: mockStatistics,
      });

      await controller.getPredictionStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatistics,
      });
    });

    it('should return 400 when area ID is missing', async () => {
      mockRequest.params = {};

      await controller.getPredictionStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Area ID is required',
      });
    });
  });

  describe('getHealthStatus', () => {
    const mockHealthStatus = {
      status: 'healthy' as const,
      checks: {
        database: true,
        historicalData: true,
        predictionModel: true,
      },
      uptime: 1500,
    };

    it('should return healthy status', async () => {
      mockPredictionService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await controller.getHealthStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockHealthStatus,
      });
    });

    it('should return degraded status', async () => {
      const degradedStatus = {
        ...mockHealthStatus,
        status: 'degraded' as const,
        checks: {
          database: true,
          historicalData: false,
          predictionModel: true,
        },
      };
      mockPredictionService.getHealthStatus.mockResolvedValue(degradedStatus);

      await controller.getHealthStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: degradedStatus,
      });
    });

    it('should return unhealthy status with 503', async () => {
      const unhealthyStatus = {
        ...mockHealthStatus,
        status: 'unhealthy' as const,
        checks: {
          database: false,
          historicalData: false,
          predictionModel: false,
        },
      };
      mockPredictionService.getHealthStatus.mockResolvedValue(unhealthyStatus);

      await controller.getHealthStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: unhealthyStatus,
      });
    });

    it('should handle health check failures', async () => {
      mockPredictionService.getHealthStatus.mockRejectedValue(new Error('Health check failed'));

      await controller.getHealthStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Health check failed',
        data: {
          status: 'unhealthy',
          checks: {
            database: false,
            historicalData: false,
            predictionModel: false,
          },
          uptime: 0,
        },
      });
    });
  });

  describe('validatePredictionRequest', () => {
    it('should validate request successfully', async () => {
      mockRequest.body = { areaId: 'area-1', timeframeYears: 5 };
      mockPredictionService.validatePredictionRequest.mockReturnValue({
        isValid: true,
        errors: [],
      });

      await controller.validatePredictionRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          isValid: true,
          errors: [],
        },
      });
    });

    it('should return validation errors', async () => {
      mockRequest.body = { areaId: '', timeframeYears: 15 };
      mockPredictionService.validatePredictionRequest.mockReturnValue({
        isValid: false,
        errors: ['Area ID is required', 'Timeframe cannot exceed 10 years'],
      });

      await controller.validatePredictionRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          isValid: false,
          errors: ['Area ID is required', 'Timeframe cannot exceed 10 years'],
        },
      });
    });
  });
});