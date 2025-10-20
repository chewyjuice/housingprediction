import { PredictionRepository } from '../PredictionRepository';
import { DatabaseConnection } from '../../database/connection';
import { PredictionRequestEntity, PredictionResultEntity, PredictionHistoryQuery } from '../../types';

// Mock the database connection
jest.mock('../../database/connection');

describe('PredictionRepository', () => {
  let predictionRepository: PredictionRepository;
  let mockDb: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(),
      close: jest.fn(),
    } as any;
    
    predictionRepository = new PredictionRepository(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('should create a new prediction request', async () => {
      const newRequest = {
        areaId: 'area-1',
        timeframeYears: 5,
        requestDate: new Date('2024-01-15'),
        userId: 'user-1',
      };

      const mockCreatedRequest: PredictionRequestEntity = {
        id: 'req-1',
        ...newRequest,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreatedRequest] } as any);

      const result = await predictionRepository.createRequest(newRequest);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO prediction_requests'),
        expect.arrayContaining(['area-1', 5, expect.any(Date), 'user-1'])
      );
      expect(result.id).toBe('req-1');
      expect(result.areaId).toBe('area-1');
    });
  });

  describe('createResult', () => {
    it('should create a new prediction result', async () => {
      const newResult = {
        requestId: 'req-1',
        predictedPrice: 850000,
        confidenceLower: 800000,
        confidenceUpper: 900000,
        influencingFactors: JSON.stringify([
          {
            developmentId: 'dev-1',
            impactWeight: 0.3,
            description: 'New MRT station'
          }
        ]),
        modelAccuracy: 0.85,
        generatedAt: new Date('2024-01-15'),
      };

      const mockCreatedResult: PredictionResultEntity = {
        id: 'res-1',
        ...newResult,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreatedResult] } as any);

      const result = await predictionRepository.createResult(newResult);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO prediction_results'),
        expect.arrayContaining(['req-1', 850000, 800000, 900000])
      );
      expect(result.id).toBe('res-1');
      expect(result.predictedPrice).toBe(850000);
    });
  });

  describe('findRequestsByAreaId', () => {
    it('should retrieve prediction requests for a specific area', async () => {
      const mockRequests: PredictionRequestEntity[] = [
        {
          id: 'req-1',
          areaId: 'area-1',
          timeframeYears: 5,
          requestDate: new Date('2024-01-15'),
          userId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockRequests } as any);

      const result = await predictionRepository.findRequestsByAreaId('area-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE area_id = $1'),
        ['area-1']
      );
      expect(result).toHaveLength(1);
      expect(result[0].areaId).toBe('area-1');
    });
  });

  describe('findResultByRequestId', () => {
    it('should retrieve prediction result for a specific request', async () => {
      const mockResult: PredictionResultEntity = {
        id: 'res-1',
        requestId: 'req-1',
        predictedPrice: 850000,
        confidenceLower: 800000,
        confidenceUpper: 900000,
        influencingFactors: '[]',
        modelAccuracy: 0.85,
        generatedAt: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockResult] } as any);

      const result = await predictionRepository.findResultByRequestId('req-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE request_id = $1'),
        ['req-1']
      );
      expect(result).not.toBeNull();
      expect(result?.requestId).toBe('req-1');
    });

    it('should return null when no result found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await predictionRepository.findResultByRequestId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getPredictionHistory', () => {
    it('should retrieve prediction history with filters', async () => {
      const query: PredictionHistoryQuery = {
        areaId: 'area-1',
        userId: 'user-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };

      const mockHistoryRows = [
        {
          request_id: 'req-1',
          area_id: 'area-1',
          timeframe_years: 5,
          request_date: new Date('2024-01-15'),
          user_id: 'user-1',
          result_id: 'res-1',
          predicted_price: 850000,
          confidence_lower: 800000,
          confidence_upper: 900000,
          influencing_factors: '[]',
          model_accuracy: 0.85,
          generated_at: new Date('2024-01-15'),
          created_at: new Date(),
          updated_at: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockHistoryRows } as any);

      const result = await predictionRepository.getPredictionHistory(query);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN prediction_results'),
        ['area-1', 'user-1', expect.any(Date), expect.any(Date)]
      );
      expect(result).toHaveLength(1);
      expect(result[0].request.areaId).toBe('area-1');
      expect(result[0].result.predictedPrice).toBe(850000);
    });
  });

  describe('getAccuracyMetrics', () => {
    it('should calculate accuracy metrics for an area', async () => {
      const mockTotalResult = {
        total_predictions: '25',
        average_accuracy: 0.82
      };

      const mockTimeframeResult = [
        {
          timeframe: 1,
          accuracy: 0.85,
          count: '10'
        },
        {
          timeframe: 5,
          accuracy: 0.78,
          count: '15'
        }
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockTotalResult] } as any)
        .mockResolvedValueOnce({ rows: mockTimeframeResult } as any);

      const result = await predictionRepository.getAccuracyMetrics('area-1');

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(result.totalPredictions).toBe(25);
      expect(result.averageAccuracy).toBe(0.82);
      expect(result.accuracyByTimeframe).toHaveLength(2);
      expect(result.accuracyByTimeframe[0].timeframe).toBe(1);
      expect(result.accuracyByTimeframe[0].accuracy).toBe(0.85);
    });

    it('should filter by timeframe when specified', async () => {
      const mockTotalResult = {
        total_predictions: '10',
        average_accuracy: 0.85
      };

      const mockTimeframeResult = [
        {
          timeframe: 5,
          accuracy: 0.85,
          count: '10'
        }
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockTotalResult] } as any)
        .mockResolvedValueOnce({ rows: mockTimeframeResult } as any);

      const result = await predictionRepository.getAccuracyMetrics('area-1', 5);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('timeframe_years = $2'),
        ['area-1', 5]
      );
      expect(result.totalPredictions).toBe(10);
    });
  });

  describe('findExpiredPredictions', () => {
    it('should find predictions that have reached their target date', async () => {
      const mockExpiredRows = [
        {
          request_id: 'req-1',
          area_id: 'area-1',
          timeframe_years: 1,
          request_date: new Date('2023-01-15'), // 1 year ago
          user_id: 'user-1',
          result_id: 'res-1',
          predicted_price: 800000,
          confidence_lower: 750000,
          confidence_upper: 850000,
          influencing_factors: '[]',
          model_accuracy: null,
          generated_at: new Date('2023-01-15'),
          created_at: new Date(),
          updated_at: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockExpiredRows } as any);

      const result = await predictionRepository.findExpiredPredictions();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '1 year'")
      );
      expect(result).toHaveLength(1);
      expect(result[0].request.timeframeYears).toBe(1);
    });
  });

  describe('getPredictionTrends', () => {
    it('should retrieve prediction trends by month', async () => {
      const mockTrends = [
        {
          month: '2024-01',
          avg_predicted_price: 850000,
          request_count: '5'
        },
        {
          month: '2024-02',
          avg_predicted_price: 860000,
          request_count: '8'
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockTrends } as any);

      const result = await predictionRepository.getPredictionTrends('area-1', 12);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '12 months'"),
        ['area-1']
      );
      expect(result).toHaveLength(2);
      expect(result[0].month).toBe('2024-01');
      expect(result[0].avgPredictedPrice).toBe(850000);
      expect(result[0].requestCount).toBe(5);
    });
  });
});