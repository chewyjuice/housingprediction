import { HistoricalPriceEntity, Area } from '../../types';
import { IHistoricalPriceRepository } from '../../repositories/HistoricalPriceRepository';

export interface PriceTrend {
  date: Date;
  price: number;
  pricePerSqft: number;
  movingAverage5Year: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number; // Annual percentage change
}

export interface AreaCharacteristics {
  mrtProximity: number;
  cbdDistance: number;
  amenityScore: number;
  developmentDensity: number;
  transportationScore: number;
  commercialScore: number;
}

export interface LinearRegressionModel {
  slope: number;
  intercept: number;
  rSquared: number;
  standardError: number;
}

export interface HistoricalAnalysisResult {
  areaId: string;
  propertyType: 'HDB' | 'Condo' | 'Landed';
  priceTrends: PriceTrend[];
  regressionModel: LinearRegressionModel;
  areaCharacteristics: AreaCharacteristics;
  averageAnnualGrowth: number;
  volatility: number;
  dataQuality: {
    recordCount: number;
    dateRange: {
      start: Date;
      end: Date;
    };
    completeness: number; // 0-1 score
  };
}

export class HistoricalPriceAnalyzer {
  constructor(
    private historicalPriceRepository: IHistoricalPriceRepository
  ) {}

  /**
   * Analyze historical price trends for a specific area and property type
   */
  public async analyzeHistoricalTrends(
    areaId: string,
    propertyType: 'HDB' | 'Condo' | 'Landed' = 'Condo'
  ): Promise<HistoricalAnalysisResult> {
    // Get 5+ years of historical data
    const historicalPrices = await this.historicalPriceRepository.getPriceHistory(
      areaId,
      propertyType,
      6 // Get 6 years to ensure we have enough data for 5-year moving average
    );

    if (historicalPrices.length < 12) {
      throw new Error(`Insufficient historical data for area ${areaId}. Need at least 12 months of data.`);
    }

    // Sort by date ascending for trend analysis
    const sortedPrices = historicalPrices.sort((a, b) => 
      new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime()
    );

    // Calculate price trends with 5-year moving averages
    const priceTrends = this.calculatePriceTrends(sortedPrices);

    // Build linear regression model
    const regressionModel = this.buildLinearRegressionModel(sortedPrices);

    // Calculate area characteristics (will be enhanced with actual area data)
    const areaCharacteristics = this.calculateAreaCharacteristics(areaId);

    // Calculate growth metrics
    const averageAnnualGrowth = this.calculateAverageAnnualGrowth(sortedPrices);
    const volatility = this.calculateVolatility(sortedPrices);

    // Assess data quality
    const dataQuality = this.assessDataQuality(sortedPrices);

    return {
      areaId,
      propertyType,
      priceTrends,
      regressionModel,
      areaCharacteristics,
      averageAnnualGrowth,
      volatility,
      dataQuality
    };
  }

  /**
   * Calculate price trends with 5-year moving averages
   */
  private calculatePriceTrends(prices: HistoricalPriceEntity[]): PriceTrend[] {
    const trends: PriceTrend[] = [];
    const windowSize = Math.min(60, Math.floor(prices.length * 0.8)); // 5 years ≈ 60 months, or 80% of data

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      
      // Calculate moving average using available data points
      const startIndex = Math.max(0, i - Math.floor(windowSize / 2));
      const endIndex = Math.min(prices.length - 1, i + Math.floor(windowSize / 2));
      const windowPrices = prices.slice(startIndex, endIndex + 1);
      
      const movingAverage5Year = windowPrices.reduce((sum, p) => sum + p.price, 0) / windowPrices.length;

      // Calculate trend direction and change rate
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      let changeRate = 0;

      if (i > 0) {
        const previousPrice = prices[i - 1].price;
        const currentPrice = price.price;
        const timeDiff = new Date(price.recordDate).getTime() - new Date(prices[i - 1].recordDate).getTime();
        const yearsDiff = timeDiff / (1000 * 60 * 60 * 24 * 365.25);
        
        if (yearsDiff > 0) {
          changeRate = ((currentPrice - previousPrice) / previousPrice) / yearsDiff * 100;
          
          if (Math.abs(changeRate) < 1) {
            trend = 'stable';
          } else if (changeRate > 0) {
            trend = 'increasing';
          } else {
            trend = 'decreasing';
          }
        }
      }

      trends.push({
        date: new Date(price.recordDate),
        price: price.price,
        pricePerSqft: price.pricePerSqft,
        movingAverage5Year,
        trend,
        changeRate
      });
    }

    return trends;
  }

  /**
   * Build linear regression model for price prediction
   */
  private buildLinearRegressionModel(prices: HistoricalPriceEntity[]): LinearRegressionModel {
    if (prices.length < 2) {
      throw new Error('Need at least 2 data points for linear regression');
    }

    // Convert dates to numeric values (months since first record)
    const firstDate = new Date(prices[0].recordDate).getTime();
    const dataPoints = prices.map(price => ({
      x: (new Date(price.recordDate).getTime() - firstDate) / (1000 * 60 * 60 * 24 * 30.44), // months
      y: price.price
    }));

    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, point) => sum + point.x, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.y, 0);
    const sumXY = dataPoints.reduce((sum, point) => sum + (point.x * point.y), 0);
    const sumXX = dataPoints.reduce((sum, point) => sum + (point.x * point.x), 0);
    const sumYY = dataPoints.reduce((sum, point) => sum + (point.y * point.y), 0);

    // Calculate slope and intercept
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const totalSumSquares = dataPoints.reduce((sum, point) => sum + Math.pow(point.y - yMean, 2), 0);
    const residualSumSquares = dataPoints.reduce((sum, point) => {
      const predicted = slope * point.x + intercept;
      return sum + Math.pow(point.y - predicted, 2);
    }, 0);
    
    const rSquared = totalSumSquares > 0 ? 1 - (residualSumSquares / totalSumSquares) : 0;

    // Calculate standard error
    const standardError = Math.sqrt(residualSumSquares / (n - 2));

    return {
      slope,
      intercept,
      rSquared,
      standardError
    };
  }

  /**
   * Calculate area characteristics scoring
   */
  private calculateAreaCharacteristics(areaId: string): AreaCharacteristics {
    // This is a simplified implementation
    // In a real system, this would integrate with actual area data
    
    // For now, return default characteristics that can be enhanced later
    return {
      mrtProximity: 0.7, // 0-1 score, higher is better
      cbdDistance: 0.6,  // 0-1 score, higher is closer
      amenityScore: 0.8, // 0-1 score based on nearby amenities
      developmentDensity: 0.5, // 0-1 score of development activity
      transportationScore: 0.7, // 0-1 score for transportation access
      commercialScore: 0.6 // 0-1 score for commercial activity
    };
  }

  /**
   * Calculate average annual growth rate
   */
  private calculateAverageAnnualGrowth(prices: HistoricalPriceEntity[]): number {
    if (prices.length < 2) return 0;

    const firstPrice = prices[0].price;
    const lastPrice = prices[prices.length - 1].price;
    const firstDate = new Date(prices[0].recordDate);
    const lastDate = new Date(prices[prices.length - 1].recordDate);
    
    const yearsDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    
    if (yearsDiff <= 0 || firstPrice <= 0) return 0;

    // Compound Annual Growth Rate (CAGR)
    const cagr = (Math.pow(lastPrice / firstPrice, 1 / yearsDiff) - 1) * 100;
    
    return Math.round(cagr * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate price volatility (standard deviation of returns)
   */
  private calculateVolatility(prices: HistoricalPriceEntity[]): number {
    if (prices.length < 2) return 0;

    // Calculate monthly returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const currentPrice = prices[i].price;
      const previousPrice = prices[i - 1].price;
      
      if (previousPrice > 0) {
        const monthlyReturn = (currentPrice - previousPrice) / previousPrice;
        returns.push(monthlyReturn);
      }
    }

    if (returns.length === 0) return 0;

    // Calculate standard deviation of returns
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(12) * 100; // Annualized volatility as percentage

    return Math.round(volatility * 100) / 100;
  }

  /**
   * Assess data quality metrics
   */
  private assessDataQuality(prices: HistoricalPriceEntity[]): {
    recordCount: number;
    dateRange: { start: Date; end: Date };
    completeness: number;
  } {
    if (prices.length === 0) {
      return {
        recordCount: 0,
        dateRange: { start: new Date(), end: new Date() },
        completeness: 0
      };
    }

    const sortedPrices = prices.sort((a, b) => 
      new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime()
    );

    const startDate = new Date(sortedPrices[0].recordDate);
    const endDate = new Date(sortedPrices[sortedPrices.length - 1].recordDate);
    
    // Calculate expected number of records (assuming monthly data)
    const monthsDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const expectedRecords = Math.max(1, Math.floor(monthsDiff));
    
    // Completeness score based on actual vs expected records
    const completeness = Math.min(1, prices.length / expectedRecords);

    return {
      recordCount: prices.length,
      dateRange: {
        start: startDate,
        end: endDate
      },
      completeness: Math.round(completeness * 100) / 100
    };
  }

  /**
   * Predict future price using linear regression
   */
  public predictPrice(
    regressionModel: LinearRegressionModel,
    monthsInFuture: number,
    baseDate: Date = new Date()
  ): { predictedPrice: number; confidence: number } {
    const predictedPrice = regressionModel.slope * monthsInFuture + regressionModel.intercept;
    
    // Confidence based on R-squared and standard error
    const confidence = Math.max(0, Math.min(1, regressionModel.rSquared * (1 - regressionModel.standardError / predictedPrice)));
    
    return {
      predictedPrice: Math.max(0, predictedPrice),
      confidence: Math.round(confidence * 100) / 100
    };
  }

  /**
   * Get area characteristics with enhanced scoring
   */
  public async getEnhancedAreaCharacteristics(area: Area): Promise<AreaCharacteristics> {
    const baseCharacteristics = area.characteristics;
    
    // Enhanced scoring based on area data
    const mrtProximity = Math.min(1, baseCharacteristics.mrtProximity / 1000); // Normalize to 0-1
    const cbdDistance = Math.max(0, 1 - (baseCharacteristics.cbdDistance / 50000)); // Closer is better, normalize to 0-1
    const amenityScore = Math.min(1, baseCharacteristics.amenityScore / 100); // Normalize to 0-1
    
    // Calculate additional scores
    const developmentDensity = 0.5; // Placeholder - would be calculated from development data
    const transportationScore = mrtProximity * 0.7 + (amenityScore * 0.3); // Weighted combination
    const commercialScore = amenityScore * 0.8; // Based on amenity score for now
    
    return {
      mrtProximity,
      cbdDistance,
      amenityScore,
      developmentDensity,
      transportationScore,
      commercialScore
    };
  }
}