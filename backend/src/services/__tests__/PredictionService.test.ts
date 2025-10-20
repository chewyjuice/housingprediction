import { PredictionService, PredictionJobResult } from '../PredictionService';
import { IPredictionRepository } from '../../repositories/PredictionRepository';
import { IAreaRepository } from '../../repositories/AreaRepository';
import { IHistoricalPriceRepository } from '../../repositories/HistoricalPriceRepository';
import { IDevelopmentRepository } from '../../repositories/DevelopmentRepository';
import { 
  CreatePredictionRequest, 
  PredictionRequest, 
  PredictionResult, 
  AreaEntity, 
  PredictionResultEntity,
  PredictionHistoryQuery 
} from '../../types';

// Mock repositories
const mockPredictionRepository: jest.Mocked<IPredictionRepository> = {
  createRequest: jest.fn(),
  findRequestById: jest.fn(),
  findRequestsByAreaId: jest.fn(),
  findRequestsByUserId: jest.fn(),
  findRequestsInDateRange: jest.fn(),
  createResult: jest.fn(),
  findResultById: jest.fn(),
  findResultByRequestId: jest.fn(),
  findResultsByAreaId: jest.fn(),
  getPredictionHistory: jest.fn(),
  getAccuracyMetrics: jest.fn(),
  findExpiredPredictions: jest.fn(),
  getPredictionTrends: jest.fn(),
};

const mockAreaRepository: jest.Mocked<IAreaRepository> = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  searchByName: jest.fn(),
  searchByQuery: jest.fn(),
  findByDistrict: jest.fn(),
  findByPostalCode: jest.fn(),
  validateCoordinates: jest.fn(),
  findNearbyAreas: jest.fn(),
  findByBoundingBox: jest.fn(),
};

const mockHistoricalPriceRepository: jest.Mocked<IHistoricalPriceRepository> = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByAreaId: jest.fn(),
  findByPropertyType: jest.fn(),
  findByAreaAndPropertyType: jest.fn(),
  findByDateRange: jest.fn(),
  getPriceHistory: jest.fn(),
  getAveragePrices: jest.fn(),
  getPriceTrends: jest.fn(),
};

const mockDevelopmentRepository: jest.Mocked<IDevelopmentRepository> = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByAreaId: jest.fn(),
  findByType: jest.fn(),
  findByAreaAndType: jest.fn(),
  findByDateRange: jest.fn(),
  findByImpactScore: jest.fn(),
  findRecentDevelopments: jest.fn(),
  searchByKeywords: jest.fn(),
  findBySourcePublisher: jest.fn(),
  getTopImpactDevelopments: jest.fn(),
  findDuplicateDevelopments: jest.fn(),
};

describe('PredictionService', () => {
  let predictionService: PredictionService;

  const mockAreaEntity: AreaEntity = {
    id: 'area-1',
    name: 'Test Area',
    district: 'Central',
    postalCodes: ['123456'],
    latitude: 1.3521,
    longitude: 103.8198,
    boundaries: JSON.stringify({
      type: 'Polygon',
      coordinates: [[[103.8, 1.35], [103.82, 1.35], [103.82, 1.37], [103.8, 1.37], [103.8, 1.35]]],
    }),
    mrtProximity: 500,
    cbdDistance: 5000,
    amenityScore: 85,
    characteristics: {
      mrtProximity: 500,
      cbdDistance: 5000,
      amenityScore: 85,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPredictionRequestEntity = {
    id: 'req-1',
    areaId: 'area-1',
    timeframeYears: 5,
    requestDate: new Date(),
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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

  beforeEach(() => {
    predictionService = new PredictionService(
      mockPredictionRepository,
      mockAreaRepository,
      mockHistoricalPriceRepository,
      mockDevelopmentRepository
    );
    jest.clearAllMocks();
  });

  describe('createPredictionRequest', () => {
    const validRequest: CreatePredictionRequest = {
      areaId: 'area-1',
      timeframeYears: 5,
    };

    it('should create prediction request successfully', async () => {
      mockAreaRepository.findById.mockResolvedValue(mockAreaEntity);
      mockPredictionRepository.createRequest.mockResolvedValue(mockPredictionRequestEntity);

      const result = await predictionService.createPredictionRequest(validRequest, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPredictionRequestEntity);
      expect(mockAreaRepository.findById).toHaveBeenCalledWith('area-1');
      expect(mockPredictionRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          areaId: 'area-1',
          timeframeYears: 5,
          userId: 'user-1',
        })
      );
    });

    it('should fail when area does not exist', async () => {
      mockAreaRepository.findById.mockResolvedValue(null);

      const result = await predictionService.createPredictionRequest(validRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Area with ID area-1 not found');
    });

    it('should fail with invalid timeframe', async () => {
      const invalidRequest: CreatePredictionRequest = {
        areaId: 'area-1',
        timeframeYears: 15, // Exceeds max of 10
      };

      const result = await predictionService.createPredictionRequest(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot exceed 10 years');
    });

    it('should fail with non-integer timeframe', async () => {
      const invalidRequest: CreatePredictionRequest = {
        areaId: 'area-1',
        timeframeYears: 5.5, // Not an integer
      };

      const result = await predictionService.createPredictionRequest(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be a whole number');
    });
  });

  describe('processPredictionRequest', () => {
    const mockResultEntity: PredictionResultEntity = {
      id: 'res-1',
      requestId: 'req-1',
      predictedPrice: 950000,
      confidenceLower: 900000,
      confidenceUpper: 1000000,
      influencingFactors: JSON.stringify([
        {
          developmentId: 'dev-1',
          impactWeight: 0.3,
          description: 'New MRT station development',
        },
      ]),
      modelAccuracy: 0.85,
      generatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      // Mock historical price data for the analyzer
      mockHistoricalPriceRepository.getPriceHistory.mockResolvedValue([
        {
          id: '1',
          areaId: 'area-1',
          price: 800000,
          pricePerSqft: 1200,
          recordDate: new Date('2019-01-01'),
          propertyType: 'Condo',
          source: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          areaId: 'area-1',
          price: 850000,
          pricePerSqft: 1275,
          recordDate: new Date('2021-01-01'),
          propertyType: 'Condo',
          source: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '3',
          areaId: 'area-1',
          price: 900000,
          pricePerSqft: 1350,
          recordDate: new Date('2023-01-01'),
          propertyType: 'Condo',
          source: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Mock development data
      mockDevelopmentRepository.findByAreaId.mockResolvedValue([
        {
          id: 'dev-1',
          areaId: 'area-1',
          type: 'infrastructure',
          title: 'New MRT Station',
          description: 'Major MRT interchange station',
          impactScore: 9,
          dateAnnounced: new Date('2023-01-01'),
          expectedCompletion: new Date('2025-12-31'),
          sourceUrl: 'https://example.com/news1',
          sourcePublisher: 'The Straits Times',
          sourcePublishDate: new Date('2023-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });

    it('should process prediction request successfully', async () => {
      mockPredictionRepository.findRequestById.mockResolvedValue(mockPredictionRequestEntity);
      mockAreaRepository.findById.mockResolvedValue(mockAreaEntity);
      mockPredictionRepository.createResult.mockResolvedValue(mockResultEntity);

      const result = await predictionService.processPredictionRequest('req-1', 'Condo');

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.predictedPrice).toBeGreaterThan(0);
      expect(result.result!.confidenceInterval.lower).toBeLessThan(result.result!.predictedPrice);
      expect(result.result!.confidenceInterval.upper).toBeGreaterThan(result.result!.predictedPrice);
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should fail when request not found', async () => {
      mockPredictionRepository.findRequestById.mockResolvedValue(null);

      const result = await predictionService.processPredictionRequest('nonexistent', 'Condo');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Prediction request not found');
    });

    it('should fail when area not found', async () => {
      mockPredictionRepository.findRequestById.mockResolvedValue(mockPredictionRequestEntity);
      mockAreaRepository.findById.mockResolvedValue(null);

      const result = await predictionService.processPredictionRequest('req-1', 'Condo');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Area not found');
    });

    it('should handle timeout gracefully', async () => {
      // Create a service with very short timeout for testing
      const shortTimeoutService = new PredictionService(
        mockPredictionRepository,
        mockAreaRepository,
        mockHistoricalPriceRepository,
        mockDevelopmentRepository,
        { predictionTimeoutMs: 1 } // 1ms timeout
      );

      mockPredictionRepository.findRequestById.mockResolvedValue(mockPredictionRequestEntity);
      mockAreaRepository.findById.mockResolvedValue(mockAreaEntity);

      const result = await shortTimeoutService.processPredictionRequest('req-1', 'Condo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should measure processing time accurately', async () => {
      mockPredictionRepository.findRequestById.mockResolvedValue(mockPredictionRequestEntity);
      mockAreaRepository.findById.mockResolvedValue(mockAreaEntity);
      mockPredictionRepository.createResult.mockResolvedValue(mockResultEntity);

      const startTime = Date.now();
      const result = await predictionService.processPredictionRequest('req-1', 'Condo');
      const endTime = Date.now();

      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeLessThanOrEqual(endTime - startTime + 10); // Allow small margin
    });
  });

  describe('getPredictionByRequestId', () => {
    it('should retrieve prediction result successfully', async () => {
      const mockResultEntity: PredictionResultEntity = {
        id: 'res-1',
        requestId: 'req-1',
        predictedPrice: 950000,
        confidenceLower: 900000,
        confidenceUpper: 1000000,
        influencingFactors: JSON.stringify([
          {
            developmentId: 'dev-1',
            impactWeight: 0.3,
            description: 'New MRT station development',
          },
        ]),
        modelAccuracy: 0.85,
        generatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPredictionRepository.findResultByRequestId.mockResolvedValue(mockResultEntity);

      const result = await predictionService.getPredictionByRequestId('req-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.predictedPrice).toBe(950000);
      expect(result.data!.confidenceInterval.lower).toBe(900000);
      expect(result.data!.confidenceInterval.upper).toBe(1000000);
      expect(result.data!.influencingFactors).toHaveLength(1);
    });

    it('should fail when prediction result not found', async () => {
      mockPredictionRepository.findResultByRequestId.mockResolvedValue(null);

      const result = await predictionService.getPredictionByRequestId('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Prediction result not found');
    });
  });

  describe('getPredictionHistory', () => {
    it('should retrieve prediction history successfully', async () => {
      const mockHistoryData = [
        {
          request: mockPredictionRequestEntity,
          result: {
            id: 'res-1',
            requestId: 'req-1',
            predictedPrice: 950000,
            confidenceLower: 900000,
            confidenceUpper: 1000000,
            influencingFactors: '[]',
            modelAccuracy: 0.85,
            generatedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      mockPredictionRepository.getPredictionHistory.mockResolvedValue(mockHistoryData);

      const query: PredictionHistoryQuery = {
        areaId: 'area-1',
        userId: 'user-1',
      };

      const result = await predictionService.getPredictionHistory(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].predictedPrice).toBe(950000);
    });

    it('should handle empty history', async () => {
      mockPredictionRepository.getPredictionHistory.mockResolvedValue([]);

      const result = await predictionService.getPredictionHistory({ areaId: 'area-1' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('getPredictionStatistics', () => {
    it('should calculate prediction statistics correctly', async () => {
      const mockResults = [
        {
          id: 'res-1',
          requestId: 'req-1',
          predictedPrice: 900000,
          confidenceLower: 850000,
          confidenceUpper: 950000,
          influencingFactors: '[]',
          modelAccuracy: 0.8,
          generatedAt: new Date('2024-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'res-2',
          requestId: 'req-2',
          predictedPrice: 1000000,
          confidenceLower: 950000,
          confidenceUpper: 1050000,
          influencingFactors: '[]',
          modelAccuracy: 0.9,
          generatedAt: new Date('2024-02-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockRequests = [
        { ...mockPredictionRequestEntity, id: 'req-1', timeframeYears: 3 },
        { ...mockPredictionRequestEntity, id: 'req-2', timeframeYears: 5 },
      ];

      mockPredictionRepository.findResultsByAreaId.mockResolvedValue(mockResults);
      mockPredictionRepository.findRequestById
        .mockResolvedValueOnce(mockRequests[0])
        .mockResolvedValueOnce(mockRequests[1]);

      const result = await predictionService.getPredictionStatistics('area-1');

      expect(result.success).toBe(true);
      expect(result.data!.totalPredictions).toBe(2);
      expect(result.data!.averagePredictedPrice).toBe(950000); // (900000 + 1000000) / 2
      expect(result.data!.averageConfidence).toBe(0.85); // (0.8 + 0.9) / 2
      expect(result.data!.timeframeDistribution[3]).toBe(1);
      expect(result.data!.timeframeDistribution[5]).toBe(1);
      expect(result.data!.lastPredictionDate).toEqual(new Date('2024-02-01'));
    });

    it('should handle areas with no predictions', async () => {
      mockPredictionRepository.findResultsByAreaId.mockResolvedValue([]);

      const result = await predictionService.getPredictionStatistics('area-1');

      expect(result.success).toBe(true);
      expect(result.data!.totalPredictions).toBe(0);
      expect(result.data!.averagePredictedPrice).toBe(0);
      expect(result.data!.averageConfidence).toBe(0);
      expect(result.data!.timeframeDistribution).toEqual({});
      expect(result.data!.lastPredictionDate).toBeNull();
    });
  });

  describe('validatePredictionRequest', () => {
    it('should validate valid request', () => {
      const validRequest: CreatePredictionRequest = {
        areaId: 'area-1',
        timeframeYears: 5,
      };

      const result = predictionService.validatePredictionRequest(validRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty area ID', () => {
      const invalidRequest: CreatePredictionRequest = {
        areaId: '',
        timeframeYears: 5,
      };

      const result = predictionService.validatePredictionRequest(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Area ID is required and must be a non-empty string');
    });

    it('should reject invalid timeframe', () => {
      const invalidRequest: CreatePredictionRequest = {
        areaId: 'area-1',
        timeframeYears: 0,
      };

      const result = predictionService.validatePredictionRequest(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Timeframe must be at least 1 year');
    });

    it('should reject multiple validation errors', () => {
      const invalidRequest: CreatePredictionRequest = {
        areaId: '',
        timeframeYears: 15,
      };

      const result = predictionService.validatePredictionRequest(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Area ID is required and must be a non-empty string');
      expect(result.errors).toContain('Timeframe cannot exceed 10 years');
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all checks pass', async () => {
      mockAreaRepository.findAll.mockResolvedValue([mockAreaEntity]);
      mockHistoricalPriceRepository.findByAreaId.mockResolvedValue([
        {
          id: '1',
          areaId: 'area-1',
          price: 800000,
          pricePerSqft: 1200,
          recordDate: new Date(),
          propertyType: 'Condo',
          source: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await predictionService.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.checks.database).toBe(true);
      expect(result.checks.historicalData).toBe(true);
      expect(result.checks.predictionModel).toBe(true);
      expect(result.uptime).toBeGreaterThan(0);
    });

    it('should return degraded status when some checks fail', async () => {
      mockAreaRepository.findAll.mockRejectedValue(new Error('Database error'));
      mockHistoricalPriceRepository.findByAreaId.mockResolvedValue([]);

      const result = await predictionService.getHealthStatus();

      expect(result.status).toBe('degraded');
      expect(result.checks.database).toBe(false);
      expect(result.checks.historicalData).toBe(false);
      expect(result.checks.predictionModel).toBe(true);
    });

    it('should return unhealthy status when most checks fail', async () => {
      mockAreaRepository.findAll.mockRejectedValue(new Error('Database error'));
      mockHistoricalPriceRepository.findByAreaId.mockRejectedValue(new Error('Data error'));

      const result = await predictionService.getHealthStatus();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database).toBe(false);
      expect(result.checks.historicalData).toBe(false);
      expect(result.checks.predictionModel).toBe(true);
    });
  });
});