import { HistoricalPriceAnalyzer, PriceTrend, AreaCharacteristics, LinearRegressionModel } from '../HistoricalPriceAnalyzer';
import { IHistoricalPriceRepository } from '../../../repositories/HistoricalPriceRepository';
import { HistoricalPriceEntity, Area } from '../../../types';

// Mock the repository
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

describe('HistoricalPriceAnalyzer', () => {
  let analyzer: HistoricalPriceAnalyzer;

  beforeEach(() => {
    analyzer = new HistoricalPriceAnalyzer(mockHistoricalPriceRepository);
    jest.clearAllMocks();
  });

  describe('analyzeHistoricalTrends', () => {
    const mockHistoricalPrices: HistoricalPriceEntity[] = [
      // Generate 24 months of data (2 years)
      ...Array.from({ length: 24 }, (_, i) => ({
        id: `${i + 1}`,
        areaId: 'area-1',
        price: 800000 + (i * 4000), // Gradual price increase
        pricePerSqft: 1200 + (i * 6),
        recordDate: new Date(2022, i, 1), // Monthly data from 2022
        propertyType: 'Condo' as const,
        source: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    ];

    it('should analyze historical trends successfully', async () => {
      mockHistoricalPriceRepository.getPriceHistory.mockResolvedValue(mockHistoricalPrices);

      const result = await analyzer.analyzeHistoricalTrends('area-1', 'Condo');

      expect(result.areaId).toBe('area-1');
      expect(result.propertyType).toBe('Condo');
      expect(result.priceTrends).toHaveLength(24);
      expect(result.regressionModel).toBeDefined();
      expect(result.averageAnnualGrowth).toBeGreaterThan(0);
      expect(result.dataQuality.recordCount).toBe(24);
    });

    it('should throw error with insufficient data', async () => {
      const insufficientData = mockHistoricalPrices.slice(0, 2); // Only 2 records
      mockHistoricalPriceRepository.getPriceHistory.mockResolvedValue(insufficientData);

      await expect(analyzer.analyzeHistoricalTrends('area-1', 'Condo'))
        .rejects.toThrow('Insufficient historical data');
    });

    it('should calculate price trends correctly', async () => {
      mockHistoricalPriceRepository.getPriceHistory.mockResolvedValue(mockHistoricalPrices);

      const result = await analyzer.analyzeHistoricalTrends('area-1', 'Condo');

      // Check that trends are calculated
      expect(result.priceTrends[0].price).toBe(800000);
      expect(result.priceTrends[0].movingAverage5Year).toBeDefined();
      expect(result.priceTrends[1].trend).toMatch(/increasing|decreasing|stable/);
      expect(result.priceTrends[1].changeRate).toBeDefined();
    });

    it('should build linear regression model', async () => {
      mockHistoricalPriceRepository.getPriceHistory.mockResolvedValue(mockHistoricalPrices);

      const result = await analyzer.analyzeHistoricalTrends('area-1', 'Condo');

      expect(result.regressionModel.slope).toBeDefined();
      expect(result.regressionModel.intercept).toBeDefined();
      expect(result.regressionModel.rSquared).toBeGreaterThanOrEqual(0);
      expect(result.regressionModel.rSquared).toBeLessThanOrEqual(1);
      expect(result.regressionModel.standardError).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average annual growth correctly', async () => {
      mockHistoricalPriceRepository.getPriceHistory.mockResolvedValue(mockHistoricalPrices);

      const result = await analyzer.analyzeHistoricalTrends('area-1', 'Condo');

      // With prices from 800k to 900k over 4 years, should be positive growth
      expect(result.averageAnnualGrowth).toBeGreaterThan(0);
      expect(result.averageAnnualGrowth).toBeLessThan(20); // Reasonable upper bound
    });

    it('should calculate volatility', async () => {
      mockHistoricalPriceRepository.getPriceHistory.mockResolvedValue(mockHistoricalPrices);

      const result = await analyzer.analyzeHistoricalTrends('area-1', 'Condo');

      expect(result.volatility).toBeGreaterThanOrEqual(0);
      expect(result.volatility).toBeLessThan(100); // Reasonable upper bound for volatility
    });

    it('should assess data quality', async () => {
      mockHistoricalPriceRepository.getPriceHistory.mockResolvedValue(mockHistoricalPrices);

      const result = await analyzer.analyzeHistoricalTrends('area-1', 'Condo');

      expect(result.dataQuality.recordCount).toBe(24);
      expect(result.dataQuality.dateRange.start).toEqual(new Date(2022, 0, 1));
      expect(result.dataQuality.dateRange.end).toEqual(new Date(2022, 23, 1));
      expect(result.dataQuality.completeness).toBeGreaterThan(0);
      expect(result.dataQuality.completeness).toBeLessThanOrEqual(1);
    });
  });

  describe('predictPrice', () => {
    const mockRegressionModel: LinearRegressionModel = {
      slope: 2000, // $2000 per month
      intercept: 800000,
      rSquared: 0.85,
      standardError: 10000,
    };

    it('should predict future price using regression model', () => {
      const result = analyzer.predictPrice(mockRegressionModel, 12); // 12 months

      expect(result.predictedPrice).toBe(824000); // 800000 + (2000 * 12)
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should return zero for negative predicted prices', () => {
      const negativeModel: LinearRegressionModel = {
        slope: -100000, // Large negative slope
        intercept: 500000,
        rSquared: 0.5,
        standardError: 50000,
      };

      const result = analyzer.predictPrice(negativeModel, 12);

      expect(result.predictedPrice).toBe(0);
    });

    it('should calculate confidence based on model quality', () => {
      const highQualityModel: LinearRegressionModel = {
        slope: 2000,
        intercept: 800000,
        rSquared: 0.95, // High R-squared
        standardError: 5000, // Low error
      };

      const lowQualityModel: LinearRegressionModel = {
        slope: 2000,
        intercept: 800000,
        rSquared: 0.3, // Low R-squared
        standardError: 50000, // High error
      };

      const highQualityResult = analyzer.predictPrice(highQualityModel, 12);
      const lowQualityResult = analyzer.predictPrice(lowQualityModel, 12);

      expect(highQualityResult.confidence).toBeGreaterThan(lowQualityResult.confidence);
    });
  });

  describe('getEnhancedAreaCharacteristics', () => {
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
        mrtProximity: 500, // 500 meters
        cbdDistance: 5000, // 5km
        amenityScore: 85, // Score out of 100
      },
    };

    it('should enhance area characteristics', async () => {
      const result = await analyzer.getEnhancedAreaCharacteristics(mockArea);

      expect(result.mrtProximity).toBeGreaterThan(0);
      expect(result.mrtProximity).toBeLessThanOrEqual(1);
      expect(result.cbdDistance).toBeGreaterThan(0);
      expect(result.cbdDistance).toBeLessThanOrEqual(1);
      expect(result.amenityScore).toBeGreaterThan(0);
      expect(result.amenityScore).toBeLessThanOrEqual(1);
      expect(result.developmentDensity).toBeDefined();
      expect(result.transportationScore).toBeDefined();
      expect(result.commercialScore).toBeDefined();
    });

    it('should normalize proximity values correctly', async () => {
      const result = await analyzer.getEnhancedAreaCharacteristics(mockArea);

      // MRT proximity should be normalized (closer = higher score)
      expect(result.mrtProximity).toBe(0.5); // 500/1000 = 0.5

      // CBD distance should be normalized (closer = higher score)
      expect(result.cbdDistance).toBe(0.9); // 1 - (5000/50000) = 0.9

      // Amenity score should be normalized
      expect(result.amenityScore).toBe(0.85); // 85/100 = 0.85
    });
  });
});