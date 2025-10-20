import { EnsemblePredictionModel, DevelopmentImpactScore, EnsemblePrediction } from '../EnsemblePredictionModel';
import { HistoricalPriceAnalyzer, HistoricalAnalysisResult, LinearRegressionModel } from '../HistoricalPriceAnalyzer';
import { IDevelopmentRepository } from '../../../repositories/DevelopmentRepository';
import { Area, DevelopmentEntity } from '../../../types';

// Mock dependencies
const mockHistoricalAnalyzer = {
  analyzeHistoricalTrends: jest.fn(),
  predictPrice: jest.fn(),
  getEnhancedAreaCharacteristics: jest.fn(),
} as unknown as jest.Mocked<HistoricalPriceAnalyzer>;

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

describe('EnsemblePredictionModel', () => {
  let ensembleModel: EnsemblePredictionModel;

  const mockArea: Area = {
    id: 'area-1',
    name: 'Test Area',
    district: 'Central',
    postalCodes: ['123456'],
    coordinates: {
      latitude: 1.3521,
      longitude: 103.8198,
      boundaries: {
        type: 'Polygon',
        coordinates: [[[103.8, 1.35], [103.82, 1.35], [103.82, 1.37], [103.8, 1.37], [103.8, 1.35]]],
      },
    },
    characteristics: {
      mrtProximity: 500,
      cbdDistance: 5000,
      amenityScore: 85,
    },
  };

  const mockHistoricalAnalysis: HistoricalAnalysisResult = {
    areaId: 'area-1',
    propertyType: 'Condo',
    priceTrends: [
      {
        date: new Date('2023-01-01'),
        price: 900000,
        pricePerSqft: 1350,
        movingAverage5Year: 850000,
        trend: 'increasing',
        changeRate: 3.5,
      },
    ],
    regressionModel: {
      slope: 2000,
      intercept: 800000,
      rSquared: 0.85,
      standardError: 10000,
    },
    areaCharacteristics: {
      mrtProximity: 0.7,
      cbdDistance: 0.6,
      amenityScore: 0.8,
      developmentDensity: 0.5,
      transportationScore: 0.7,
      commercialScore: 0.6,
    },
    averageAnnualGrowth: 3.2,
    volatility: 8.5,
    dataQuality: {
      recordCount: 60,
      dateRange: {
        start: new Date('2018-01-01'),
        end: new Date('2023-01-01'),
      },
      completeness: 0.9,
    },
  };

  const mockDevelopments: DevelopmentEntity[] = [
    {
      id: 'dev-1',
      areaId: 'area-1',
      type: 'infrastructure',
      title: 'New MRT Station',
      description: 'Major MRT interchange station connecting multiple lines',
      impactScore: 9,
      dateAnnounced: new Date('2023-01-01'),
      expectedCompletion: new Date('2025-12-31'),
      sourceUrl: 'https://example.com/news1',
      sourcePublisher: 'The Straits Times',
      sourcePublishDate: new Date('2023-01-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'dev-2',
      areaId: 'area-1',
      type: 'shopping',
      title: 'New Shopping Mall',
      description: 'Large shopping complex with retail and dining',
      impactScore: 7,
      dateAnnounced: new Date('2023-06-01'),
      expectedCompletion: new Date('2026-06-30'),
      sourceUrl: 'https://example.com/news2',
      sourcePublisher: 'Channel NewsAsia',
      sourcePublishDate: new Date('2023-06-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    ensembleModel = new EnsemblePredictionModel(mockHistoricalAnalyzer, mockDevelopmentRepository);
    jest.clearAllMocks();
    
    // Mock the predictPrice method
    mockHistoricalAnalyzer.predictPrice.mockReturnValue({
      predictedPrice: 950000,
      confidence: 0.85,
    });
  });

  describe('generateEnsemblePrediction', () => {
    beforeEach(() => {
      mockHistoricalAnalyzer.analyzeHistoricalTrends.mockResolvedValue(mockHistoricalAnalysis);
      mockHistoricalAnalyzer.getEnhancedAreaCharacteristics.mockResolvedValue(mockHistoricalAnalysis.areaCharacteristics);
      mockDevelopmentRepository.findByAreaId.mockResolvedValue(mockDevelopments);
    });

    it('should generate ensemble prediction successfully', async () => {
      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      expect(result.predictedPrice).toBeGreaterThan(0);
      expect(result.confidenceInterval.lower).toBeLessThan(result.predictedPrice);
      expect(result.confidenceInterval.upper).toBeGreaterThan(result.predictedPrice);
      expect(result.modelWeights.historical).toBeGreaterThan(0);
      expect(result.modelWeights.development).toBeGreaterThan(0);
      expect(result.modelWeights.characteristics).toBeGreaterThan(0);
      expect(result.modelWeights.sentiment).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.explanation).toBeDefined();
      expect(result.influencingFactors).toBeDefined();
    });

    it('should include significant developments in influencing factors', async () => {
      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      expect(result.influencingFactors.length).toBeGreaterThan(0);
      expect(result.influencingFactors[0].developmentId).toBeDefined();
      expect(result.influencingFactors[0].impactWeight).toBeGreaterThan(0);
      expect(result.influencingFactors[0].description).toBeDefined();
    });

    it('should calculate model weights based on data quality', async () => {
      // Test with high quality historical data
      const highQualityAnalysis = {
        ...mockHistoricalAnalysis,
        dataQuality: { ...mockHistoricalAnalysis.dataQuality, completeness: 0.95 },
        regressionModel: { ...mockHistoricalAnalysis.regressionModel, rSquared: 0.9 },
      };
      mockHistoricalAnalyzer.analyzeHistoricalTrends.mockResolvedValue(highQualityAnalysis);

      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      // Historical weight should be higher with good data quality
      expect(result.modelWeights.historical).toBeGreaterThan(0.3);
      
      // All weights should sum to approximately 1
      const totalWeight = result.modelWeights.historical + result.modelWeights.development + 
                         result.modelWeights.characteristics + result.modelWeights.sentiment;
      expect(Math.abs(totalWeight - 1)).toBeLessThan(0.01);
    });

    it('should handle areas with no developments', async () => {
      mockDevelopmentRepository.findByAreaId.mockResolvedValue([]);

      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      expect(result.predictedPrice).toBeGreaterThan(0);
      expect(result.influencingFactors).toHaveLength(0);
      expect(result.modelWeights.development).toBeLessThan(result.modelWeights.historical);
    });

    it('should adjust predictions based on timeframe', async () => {
      const shortTermResult = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 1, 'Condo');
      const longTermResult = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 10, 'Condo');

      // Longer timeframes should generally result in higher predicted prices (assuming positive growth)
      expect(longTermResult.predictedPrice).toBeGreaterThan(shortTermResult.predictedPrice);
    });

    it('should generate confidence intervals', async () => {
      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      expect(result.confidenceInterval.lower).toBeLessThan(result.predictedPrice);
      expect(result.confidenceInterval.upper).toBeGreaterThan(result.predictedPrice);
      
      // Confidence interval should be reasonable (not too wide or narrow)
      const intervalWidth = result.confidenceInterval.upper - result.confidenceInterval.lower;
      const relativeWidth = intervalWidth / result.predictedPrice;
      expect(relativeWidth).toBeGreaterThan(0.1); // At least 10% width
      expect(relativeWidth).toBeLessThan(0.5); // Not more than 50% width
    });
  });

  describe('development impact calculation', () => {
    beforeEach(() => {
      mockHistoricalAnalyzer.analyzeHistoricalTrends.mockResolvedValue(mockHistoricalAnalysis);
      mockHistoricalAnalyzer.getEnhancedAreaCharacteristics.mockResolvedValue(mockHistoricalAnalysis.areaCharacteristics);
      mockDevelopmentRepository.findByAreaId.mockResolvedValue(mockDevelopments);
    });

    it('should calculate development impact scores correctly', async () => {
      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      // Should have influencing factors from developments
      expect(result.influencingFactors.length).toBeGreaterThan(0);
      
      // Infrastructure should have higher impact than shopping
      const infrastructureFactor = result.influencingFactors.find(f => f.developmentId === 'dev-1');
      const shoppingFactor = result.influencingFactors.find(f => f.developmentId === 'dev-2');
      
      if (infrastructureFactor && shoppingFactor) {
        expect(infrastructureFactor.impactWeight).toBeGreaterThan(shoppingFactor.impactWeight);
      }
    });

    it('should filter out developments too far in the future', async () => {
      const farFutureDevelopment: DevelopmentEntity = {
        ...mockDevelopments[0],
        id: 'dev-future',
        expectedCompletion: new Date('2040-01-01'), // Very far future
      };
      
      mockDevelopmentRepository.findByAreaId.mockResolvedValue([...mockDevelopments, farFutureDevelopment]);

      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      // Should not include the far future development
      const farFutureFactor = result.influencingFactors.find(f => f.developmentId === 'dev-future');
      expect(farFutureFactor).toBeUndefined();
    });

    it('should apply time decay to development impacts', async () => {
      // Create developments with different completion times
      const nearTermDev: DevelopmentEntity = {
        ...mockDevelopments[0],
        id: 'dev-near',
        expectedCompletion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      };
      
      const longTermDev: DevelopmentEntity = {
        ...mockDevelopments[0],
        id: 'dev-long',
        expectedCompletion: new Date(Date.now() + 4 * 365 * 24 * 60 * 60 * 1000), // 4 years from now
      };

      mockDevelopmentRepository.findByAreaId.mockResolvedValue([nearTermDev, longTermDev]);

      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      const nearTermFactor = result.influencingFactors.find(f => f.developmentId === 'dev-near');
      const longTermFactor = result.influencingFactors.find(f => f.developmentId === 'dev-long');

      // Near-term development should have higher impact due to time decay
      if (nearTermFactor && longTermFactor) {
        expect(nearTermFactor.impactWeight).toBeGreaterThan(longTermFactor.impactWeight);
      }
    });
  });

  describe('prediction explanation generation', () => {
    beforeEach(() => {
      mockHistoricalAnalyzer.analyzeHistoricalTrends.mockResolvedValue(mockHistoricalAnalysis);
      mockHistoricalAnalyzer.getEnhancedAreaCharacteristics.mockResolvedValue(mockHistoricalAnalysis.areaCharacteristics);
      mockDevelopmentRepository.findByAreaId.mockResolvedValue(mockDevelopments);
    });

    it('should generate meaningful explanation', async () => {
      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      expect(result.explanation).toBeDefined();
      expect(result.explanation.length).toBeGreaterThan(0);
      expect(result.explanation).toMatch(/growth|development|confidence/i);
    });

    it('should include historical trends in explanation', async () => {
      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      // Should mention positive growth since mockHistoricalAnalysis has positive averageAnnualGrowth
      expect(result.explanation).toMatch(/positive.*growth|growth.*3\.2/i);
    });

    it('should mention significant developments in explanation', async () => {
      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      // Should mention developments since we have 2 significant developments
      expect(result.explanation).toMatch(/development/i);
    });

    it('should include confidence percentage in explanation', async () => {
      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      expect(result.explanation).toMatch(/confidence.*\d+%/i);
    });
  });

  describe('confidence calculation', () => {
    beforeEach(() => {
      mockHistoricalAnalyzer.analyzeHistoricalTrends.mockResolvedValue(mockHistoricalAnalysis);
      mockHistoricalAnalyzer.getEnhancedAreaCharacteristics.mockResolvedValue(mockHistoricalAnalysis.areaCharacteristics);
      mockDevelopmentRepository.findByAreaId.mockResolvedValue(mockDevelopments);
    });

    it('should calculate higher confidence with better data quality', async () => {
      // Test with high quality data
      const highQualityAnalysis = {
        ...mockHistoricalAnalysis,
        dataQuality: { ...mockHistoricalAnalysis.dataQuality, completeness: 0.95 },
        regressionModel: { ...mockHistoricalAnalysis.regressionModel, rSquared: 0.9 },
      };
      mockHistoricalAnalyzer.analyzeHistoricalTrends.mockResolvedValue(highQualityAnalysis);

      const highQualityResult = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      // Test with low quality data
      const lowQualityAnalysis = {
        ...mockHistoricalAnalysis,
        dataQuality: { ...mockHistoricalAnalysis.dataQuality, completeness: 0.3 },
        regressionModel: { ...mockHistoricalAnalysis.regressionModel, rSquared: 0.2 },
      };
      mockHistoricalAnalyzer.analyzeHistoricalTrends.mockResolvedValue(lowQualityAnalysis);

      const lowQualityResult = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      expect(highQualityResult.confidence).toBeGreaterThan(lowQualityResult.confidence);
    });

    it('should calculate higher confidence with more developments', async () => {
      // Test with many developments
      const manyDevelopments = [
        ...mockDevelopments,
        { ...mockDevelopments[0], id: 'dev-3', type: 'school' as const },
        { ...mockDevelopments[0], id: 'dev-4', type: 'business' as const },
      ];
      mockDevelopmentRepository.findByAreaId.mockResolvedValue(manyDevelopments);

      const manyDevsResult = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      // Test with few developments
      mockDevelopmentRepository.findByAreaId.mockResolvedValue([mockDevelopments[0]]);

      const fewDevsResult = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      expect(manyDevsResult.confidence).toBeGreaterThan(fewDevsResult.confidence);
    });

    it('should return confidence between 0 and 1', async () => {
      const result = await ensembleModel.generateEnsemblePrediction('area-1', mockArea, 5, 'Condo');

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});