import { resalePriceExtractor, ResaleTransaction, PrivateTransaction } from './ResalePriceExtractor';
import { fileStorage } from '../database/fileStorage';
import { modelTrainingService, ModelPredictionInput, ModelPredictionOutput } from './ModelTrainingService';

export interface MarketPredictionInput {
  areaId: string;
  district: string;
  propertyType: 'HDB' | 'Condo' | 'Landed';
  unitSize: number;
  roomType?: string;
  timeframeYears: number;
}

export interface MarketPredictionResult {
  predictedPrice: number;
  predictedPricePerUnit: number;
  predictedPricePerSqft: number;
  confidenceInterval: {
    lower: number;
    upper: number;
    lowerPerUnit: number;
    upperPerUnit: number;
    lowerPerSqft: number;
    upperPerSqft: number;
  };
  marketAnalysis: {
    currentMarketPrice: number;
    marketTrend: number; // Percentage change
    transactionVolume: number;
    priceGrowthRate: number; // Annual growth rate
    marketConfidence: number; // 0-1 scale
  };
  comparableTransactions: Array<{
    price: number;
    pricePerUnit: number;
    date: string;
    area: number;
    type: string;
  }>;
  modelMetrics: {
    accuracy: number;
    sampleSize: number;
    dataRecency: string;
  };
}

export class MarketBasedPredictionModel {
  constructor() {}

  /**
   * Generate market-based price prediction using trained model (fast inference)
   */
  async generatePrediction(input: MarketPredictionInput): Promise<MarketPredictionResult> {
    console.log(`[PREDICTION] 🚀 Fast inference for ${input.district}, ${input.propertyType}`);
    
    try {
      // Try to use trained model for fast inference
      const modelInput: ModelPredictionInput = {
        district: input.district,
        propertyType: input.propertyType,
        unitSize: input.unitSize,
        roomType: input.roomType,
        timeframeYears: input.timeframeYears
      };
      
      const modelPrediction = await modelTrainingService.predict(modelInput);
      
      // Get comparable transactions for additional context
      const comparables = await this.getComparableTransactions(input);
      
      // Convert model prediction to our format
      const result: MarketPredictionResult = {
        predictedPrice: modelPrediction.predictedPrice,
        predictedPricePerUnit: modelPrediction.predictedPricePerUnit,
        predictedPricePerSqft: modelPrediction.predictedPricePerUnit, // Map to frontend expected field
        confidenceInterval: {
          lower: modelPrediction.confidenceInterval.lower,
          upper: modelPrediction.confidenceInterval.upper,
          lowerPerUnit: modelPrediction.confidenceInterval.lowerPerUnit,
          upperPerUnit: modelPrediction.confidenceInterval.upperPerUnit,
          lowerPerSqft: modelPrediction.confidenceInterval.lowerPerUnit, // Map to frontend expected field
          upperPerSqft: modelPrediction.confidenceInterval.upperPerUnit  // Map to frontend expected field
        },
        marketAnalysis: {
          currentMarketPrice: modelPrediction.marketAnalysis.currentMarketPrice,
          marketTrend: modelPrediction.marketAnalysis.marketTrend,
          transactionVolume: modelPrediction.marketAnalysis.transactionVolume,
          priceGrowthRate: modelPrediction.marketAnalysis.priceGrowthRate,
          marketConfidence: modelPrediction.marketAnalysis.marketConfidence
        },
        comparableTransactions: comparables.slice(0, 5), // Top 5 comparables
        modelMetrics: {
          accuracy: modelPrediction.modelInfo.accuracy,
          sampleSize: modelPrediction.marketAnalysis.transactionVolume,
          dataRecency: modelPrediction.modelInfo.trainedAt
        }
      };
      
      console.log(`[PREDICTION] ⚡ Fast inference completed: $${result.predictedPrice.toLocaleString()}`);
      console.log(`[PREDICTION] 📊 Model version: ${modelPrediction.modelInfo.version}, Accuracy: ${(modelPrediction.modelInfo.accuracy * 100).toFixed(1)}%`);
      
      return result;
      
    } catch (error) {
      console.warn('[PREDICTION] ⚠️ Trained model inference failed, falling back to traditional method:', error instanceof Error ? error.message : 'Unknown error');
      
      // Fallback to traditional market-based prediction
      return await this.generateTraditionalPrediction(input);
    }
  }

  /**
   * Traditional market-based prediction (fallback when trained model unavailable)
   */
  private async generateTraditionalPrediction(input: MarketPredictionInput): Promise<MarketPredictionResult> {
    console.log(`[PREDICTION] 🔄 Using traditional prediction method for ${input.district}, ${input.propertyType}`);
    
    try {
      // Get market data for basic statistics
      const marketData = await resalePriceExtractor.extractDataWithFallback();
      
      // Calculate basic market statistics
      const relevantTransactions = input.propertyType === 'HDB' 
        ? marketData.hdb.slice(0, 100) // Use recent HDB transactions
        : marketData.private.slice(0, 100); // Use recent private transactions
      
      if (relevantTransactions.length === 0) {
        throw new Error(`No market data available for ${input.district} ${input.propertyType}`);
      }
      
      // Calculate basic market stats
      const prices = relevantTransactions.map(t => 'resalePrice' in t ? t.resalePrice : t.price);
      const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      
      // Calculate average price per unit
      let averagePricePerUnit = 0;
      if (input.propertyType === 'HDB') {
        // For HDB, calculate price per sqm
        const hdbTransactions = relevantTransactions as any[];
        const pricesPerSqm = hdbTransactions.map(t => t.resalePrice / (t.floorAreaSqm || 100));
        averagePricePerUnit = pricesPerSqm.reduce((sum, price) => sum + price, 0) / pricesPerSqm.length;
      } else {
        // For private, calculate price per sqft
        const privateTransactions = relevantTransactions as any[];
        const pricesPerSqft = privateTransactions.map(t => t.price / (t.areaSize || 1000));
        averagePricePerUnit = pricesPerSqft.reduce((sum, price) => sum + price, 0) / pricesPerSqft.length;
      }
      
      const marketStats = {
        averagePrice: Math.round(averagePrice),
        averagePricePerUnit: Math.round(averagePricePerUnit || averagePrice / 1000), // Fallback calculation
        totalTransactions: relevantTransactions.length,
        trendPercentage: 2.5, // Default 2.5% growth
        lastUpdated: new Date().toISOString()
      };
      
      // Get comparable transactions
      const comparables = await this.getComparableTransactions(input);
      
      // Calculate base price using market data
      const basePrice = this.calculateBasePrice(input, marketStats, comparables);
      
      // Apply time-based projection
      const projectedPrice = this.applyTimeProjection(basePrice, input.timeframeYears, marketStats);
      
      // Calculate confidence intervals
      const confidence = this.calculateConfidenceInterval(projectedPrice, marketStats, input.timeframeYears);
      
      // Calculate price per unit
      const pricePerUnit = input.propertyType === 'HDB' 
        ? projectedPrice / input.unitSize // Price per sqm for HDB
        : projectedPrice / (input.unitSize * 10.764); // Price per sqft for private (convert sqm to sqft)
      
      const result: MarketPredictionResult = {
        predictedPrice: Math.round(projectedPrice),
        predictedPricePerUnit: Math.round(pricePerUnit),
        predictedPricePerSqft: Math.round(pricePerUnit), // Map to frontend expected field
        confidenceInterval: {
          lower: Math.round(confidence.lower),
          upper: Math.round(confidence.upper),
          lowerPerUnit: Math.round(confidence.lower / (input.propertyType === 'HDB' ? input.unitSize : input.unitSize * 10.764)),
          upperPerUnit: Math.round(confidence.upper / (input.propertyType === 'HDB' ? input.unitSize : input.unitSize * 10.764)),
          lowerPerSqft: Math.round(confidence.lower / (input.propertyType === 'HDB' ? input.unitSize : input.unitSize * 10.764)), // Map to frontend expected field
          upperPerSqft: Math.round(confidence.upper / (input.propertyType === 'HDB' ? input.unitSize : input.unitSize * 10.764))  // Map to frontend expected field
        },
        marketAnalysis: {
          currentMarketPrice: marketStats.averagePrice,
          marketTrend: marketStats.trendPercentage,
          transactionVolume: marketStats.totalTransactions,
          priceGrowthRate: this.calculateGrowthRate(marketStats),
          marketConfidence: this.calculateMarketConfidence(marketStats)
        },
        comparableTransactions: comparables.slice(0, 5), // Top 5 comparables
        modelMetrics: {
          accuracy: this.calculateModelAccuracy(marketStats),
          sampleSize: marketStats.totalTransactions,
          dataRecency: marketStats.lastUpdated
        }
      };
      
      console.log(`[PREDICTION] Generated traditional prediction: $${result.predictedPrice.toLocaleString()}`);
      return result;
      
    } catch (error) {
      console.error('[PREDICTION] Error generating traditional prediction:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Calculate base price using market data and comparables
   */
  private calculateBasePrice(
    input: MarketPredictionInput,
    marketStats: any,
    comparables: any[]
  ): number {
    // Start with market average
    let basePrice = marketStats.averagePrice;
    
    // Adjust based on unit size
    if (input.propertyType === 'HDB') {
      // For HDB, use price per sqm
      basePrice = marketStats.averagePricePerUnit * input.unitSize;
    } else {
      // For private properties, use price per sqft
      const unitSizeInSqft = input.unitSize * 10.764; // Convert sqm to sqft
      basePrice = marketStats.averagePricePerUnit * unitSizeInSqft;
    }
    
    // Adjust based on comparables if available
    if (comparables.length > 0) {
      const comparableAvg = comparables.reduce((sum, comp) => sum + comp.price, 0) / comparables.length;
      // Weight: 70% market average, 30% comparables
      basePrice = (basePrice * 0.7) + (comparableAvg * 0.3);
    }
    
    // Apply area-specific adjustments
    basePrice = this.applyAreaAdjustments(basePrice, input.district, input.propertyType);
    
    return basePrice;
  }

  /**
   * Apply time-based projection for future price
   */
  private applyTimeProjection(basePrice: number, years: number, marketStats: any): number {
    // Calculate annual growth rate based on recent trends
    let annualGrowthRate = 0.03; // Default 3% annual growth
    
    // Adjust based on recent market trend
    if (marketStats.trendPercentage > 0) {
      // Positive trend - extrapolate but cap at reasonable levels
      annualGrowthRate = Math.min(marketStats.trendPercentage / 100 * 2, 0.08); // Cap at 8%
    } else {
      // Negative trend - be more conservative
      annualGrowthRate = Math.max(marketStats.trendPercentage / 100 * 0.5, -0.02); // Floor at -2%
    }
    
    // Apply compound growth
    const projectedPrice = basePrice * Math.pow(1 + annualGrowthRate, years);
    
    return projectedPrice;
  }

  /**
   * Calculate confidence interval based on market volatility
   */
  private calculateConfidenceInterval(price: number, marketStats: any, years: number) {
    // Base confidence interval: ±15% for 1 year, increasing with time
    let confidenceRange = 0.15 + (years - 1) * 0.05; // 15% + 5% per additional year
    
    // Adjust based on market confidence
    const marketConfidence = this.calculateMarketConfidence(marketStats);
    confidenceRange = confidenceRange * (2 - marketConfidence); // Lower confidence = wider range
    
    // Cap the range
    confidenceRange = Math.min(confidenceRange, 0.4); // Max ±40%
    
    return {
      lower: price * (1 - confidenceRange),
      upper: price * (1 + confidenceRange)
    };
  }

  /**
   * Get comparable transactions
   */
  private async getComparableTransactions(input: MarketPredictionInput) {
    try {
      let transactions: any[] = [];
      
      if (input.propertyType === 'HDB') {
        const hdbData = await fileStorage.readData<ResaleTransaction>('hdb_resale_transactions');
        transactions = hdbData
          .filter(t => 
            t.district === input.district &&
            (!input.roomType || t.flatType.toLowerCase().includes(input.roomType.toLowerCase().replace('-room', ''))) &&
            Math.abs(t.floorAreaSqm - input.unitSize) <= input.unitSize * 0.3 // Within 30% of target size
          )
          .map(t => ({
            price: t.resalePrice,
            pricePerUnit: t.pricePerSqm,
            date: t.month,
            area: t.floorAreaSqm,
            type: t.flatType
          }));
      } else {
        const privateData = await fileStorage.readData<PrivateTransaction>('private_property_transactions');
        const targetSizeInSqft = input.unitSize * 10.764;
        transactions = privateData
          .filter(t => 
            t.district === input.district &&
            Math.abs(t.areaSize - targetSizeInSqft) <= targetSizeInSqft * 0.3 // Within 30% of target size
          )
          .map(t => ({
            price: t.price,
            pricePerUnit: t.pricePerSqft,
            date: t.dateOfSale,
            area: t.areaSize,
            type: t.propertyType
          }));
      }
      
      // Sort by recency and similarity
      return transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10); // Top 10 most recent
        
    } catch (error) {
      console.error('[PREDICTION] Error getting comparable transactions:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Apply area-specific price adjustments
   */
  private applyAreaAdjustments(basePrice: number, district: string, propertyType: string): number {
    // Premium/discount factors for different districts
    const districtMultipliers: { [key: string]: number } = {
      'District 1': 1.3,  // CBD premium
      'District 2': 1.2,  // Tanjong Pagar premium
      'District 3': 1.1,  // Tiong Bahru/Queenstown premium
      'District 4': 1.15, // Sentosa premium
      'District 9': 1.4,  // Orchard premium
      'District 10': 1.35, // Bukit Timah premium
      'District 11': 1.25, // Novena premium
      'District 5': 1.0,  // Clementi baseline
      'District 12': 1.0, // Toa Payoh baseline
      'District 14': 0.95, // Geylang discount
      'District 15': 1.05, // Marine Parade slight premium
      'District 16': 0.9,  // Bedok discount
      'District 18': 0.85, // Tampines/Pasir Ris discount
      'District 19': 0.8,  // Hougang/Sengkang discount
      'District 20': 0.9,  // Bishan/Ang Mo Kio discount
      'District 22': 0.75, // Jurong discount
      'District 23': 0.7,  // Bukit Batok/Choa Chu Kang discount
      'District 25': 0.65, // Woodlands discount
      'District 27': 0.6   // Sembawang/Yishun discount
    };
    
    const multiplier = districtMultipliers[district] || 1.0;
    
    // Additional adjustment for property type
    let typeMultiplier = 1.0;
    if (propertyType === 'HDB') {
      typeMultiplier = 0.8; // HDB generally lower than private
    } else if (propertyType === 'Landed') {
      typeMultiplier = 1.5; // Landed premium
    }
    
    return basePrice * multiplier * typeMultiplier;
  }

  /**
   * Calculate annual growth rate from market statistics
   */
  private calculateGrowthRate(marketStats: any): number {
    // Convert 6-month trend to annual rate
    const sixMonthTrend = marketStats.trendPercentage / 100;
    const annualRate = Math.pow(1 + sixMonthTrend, 2) - 1; // Compound to annual
    
    // Cap at reasonable bounds
    return Math.max(-0.1, Math.min(0.15, annualRate)); // -10% to +15%
  }

  /**
   * Calculate market confidence score
   */
  private calculateMarketConfidence(marketStats: any): number {
    let confidence = 0.5; // Base confidence
    
    // Higher transaction volume = higher confidence
    if (marketStats.totalTransactions > 100) confidence += 0.2;
    else if (marketStats.totalTransactions > 50) confidence += 0.1;
    
    // Stable trends = higher confidence
    const trendAbs = Math.abs(marketStats.trendPercentage);
    if (trendAbs < 5) confidence += 0.2; // Stable market
    else if (trendAbs > 20) confidence -= 0.2; // Volatile market
    
    // Recent data = higher confidence
    const dataAge = (Date.now() - new Date(marketStats.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
    if (dataAge < 7) confidence += 0.1; // Data less than a week old
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Calculate model accuracy based on data quality
   */
  private calculateModelAccuracy(marketStats: any): number {
    let accuracy = 0.6; // Base accuracy
    
    // More transactions = higher accuracy
    if (marketStats.totalTransactions > 200) accuracy += 0.2;
    else if (marketStats.totalTransactions > 100) accuracy += 0.15;
    else if (marketStats.totalTransactions > 50) accuracy += 0.1;
    
    // Market confidence affects accuracy
    const marketConfidence = this.calculateMarketConfidence(marketStats);
    accuracy += marketConfidence * 0.2;
    
    return Math.max(0.5, Math.min(0.95, accuracy));
  }

  /**
   * Initialize the prediction model with training service
   */
  async initialize(): Promise<void> {
    console.log('[PREDICTION] Initializing market-based prediction model with training service...');
    
    try {
      // Initialize the model training service (handles weekly training)
      await modelTrainingService.initialize();
      
      console.log('[PREDICTION] ✅ Market-based prediction model ready for fast inference');
      
      // Log current model info
      const modelInfo = modelTrainingService.getCurrentModelInfo();
      if (modelInfo) {
        console.log(`[PREDICTION] 📊 Current model: ${modelInfo.version} (${(modelInfo.accuracy.overall * 100).toFixed(1)}% accuracy)`);
        console.log(`[PREDICTION] 📅 Trained: ${new Date(modelInfo.trainedAt).toLocaleDateString()}`);
        console.log(`[PREDICTION] 📈 Data range: ${modelInfo.dataRange.hdbTransactions} HDB + ${modelInfo.dataRange.privateTransactions} private transactions`);
      }
      
    } catch (error) {
      console.error('[PREDICTION] Error initializing prediction model:', error instanceof Error ? error.message : 'Unknown error');
      console.log('[PREDICTION] ⚠️ Will fall back to traditional prediction methods');
    }
  }
}

export const marketBasedPredictionModel = new MarketBasedPredictionModel();