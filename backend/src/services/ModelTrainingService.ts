import { fileStorage } from '../database/fileStorage';
import { resalePriceExtractor, ResaleTransaction, PrivateTransaction } from './ResalePriceExtractor';

export interface TrainedModel {
  id: string;
  version: string;
  trainedAt: string;
  dataRange: {
    startDate: string;
    endDate: string;
    hdbTransactions: number;
    privateTransactions: number;
  };
  modelWeights: {
    [district: string]: {
      [propertyType: string]: {
        basePrice: number;
        pricePerUnit: number;
        growthRate: number;
        volatility: number;
        confidence: number;
      };
    };
  };
  marketTrends: {
    [district: string]: {
      sixMonthTrend: number;
      yearOverYearGrowth: number;
      transactionVolume: number;
      averagePrice: number;
    };
  };
  accuracy: {
    overall: number;
    byPropertyType: {
      HDB: number;
      Condo: number;
      Landed: number;
    };
    byDistrict: { [district: string]: number };
  };
}

export interface ModelPredictionInput {
  district: string;
  propertyType: 'HDB' | 'Condo' | 'Landed';
  unitSize: number;
  roomType?: string;
  timeframeYears: number;
}

export interface ModelPredictionOutput {
  predictedPrice: number;
  predictedPricePerUnit: number;
  confidenceInterval: {
    lower: number;
    upper: number;
    lowerPerUnit: number;
    upperPerUnit: number;
  };
  marketAnalysis: {
    currentMarketPrice: number;
    marketTrend: number;
    transactionVolume: number;
    priceGrowthRate: number;
    marketConfidence: number;
  };
  modelInfo: {
    version: string;
    trainedAt: string;
    accuracy: number;
  };
}

export class ModelTrainingService {
  private currentModel: TrainedModel | null = null;

  constructor() {
    this.loadCurrentModel();
  }

  /**
   * Initialize the service (inference only)
   */
  async initialize(): Promise<void> {
    console.log('[TRAINING] Initializing Model Training Service for inference...');
    await this.loadCurrentModel();
    console.log('[TRAINING] ✅ Model Training Service initialized for inference');
  }

  /**
   * Load current model from storage
   */
  private async loadCurrentModel(): Promise<void> {
    try {
      const models = await fileStorage.readData<TrainedModel>('trained_models');
      if (models.length > 0) {
        this.currentModel = models[models.length - 1]; // Get latest model
        console.log(`[TRAINING] ✅ Loaded model: ${this.currentModel.version}`);
      } else {
        console.log('[TRAINING] ⚠️ No trained model found');
      }
    } catch (error) {
      console.error('[TRAINING] Error loading model:', error);
    }
  }

  /**
   * Get current model information
   */
  getCurrentModelInfo(): TrainedModel | null {
    return this.currentModel;
  }

  /**
   * Make prediction using trained model
   */
  async predict(input: ModelPredictionInput): Promise<ModelPredictionOutput> {
    if (!this.currentModel) {
      throw new Error('No trained model available for predictions');
    }

    const { district, propertyType, unitSize, timeframeYears } = input;

    // Get model weights for this district and property type
    const districtWeights = this.currentModel.modelWeights[district];
    if (!districtWeights || !districtWeights[propertyType]) {
      throw new Error(`No model data available for ${district} ${propertyType}`);
    }

    const weights = districtWeights[propertyType];
    const marketTrend = this.currentModel.marketTrends[district];

    // Calculate base prediction
    const basePrice = weights.pricePerUnit * unitSize;
    const growthMultiplier = Math.pow(1 + weights.growthRate, timeframeYears);
    const predictedPrice = basePrice * growthMultiplier;

    // Calculate confidence interval
    const volatilityFactor = weights.volatility * 0.5; // 50% of volatility for confidence interval
    const confidenceInterval = {
      lower: predictedPrice * (1 - volatilityFactor),
      upper: predictedPrice * (1 + volatilityFactor),
      lowerPerUnit: (predictedPrice * (1 - volatilityFactor)) / unitSize,
      upperPerUnit: (predictedPrice * (1 + volatilityFactor)) / unitSize
    };

    // Market analysis
    const marketAnalysis = {
      currentMarketPrice: basePrice,
      marketTrend: marketTrend?.sixMonthTrend || 0,
      transactionVolume: marketTrend?.transactionVolume || 0,
      priceGrowthRate: weights.growthRate * 100,
      marketConfidence: weights.confidence
    };

    // Apply validation bounds to prevent unrealistic predictions
    const validatedPrice = this.applyValidationBounds(predictedPrice, propertyType, unitSize);
    const validatedLower = this.applyValidationBounds(confidenceInterval.lower, propertyType, unitSize);
    const validatedUpper = this.applyValidationBounds(confidenceInterval.upper, propertyType, unitSize);

    return {
      predictedPrice: Math.round(validatedPrice),
      predictedPricePerUnit: Math.round(validatedPrice / unitSize),
      confidenceInterval: {
        lower: Math.round(validatedLower),
        upper: Math.round(validatedUpper),
        lowerPerUnit: Math.round(validatedLower / unitSize),
        upperPerUnit: Math.round(validatedUpper / unitSize)
      },
      marketAnalysis,
      modelInfo: {
        version: this.currentModel.version,
        trainedAt: this.currentModel.trainedAt,
        accuracy: this.currentModel.accuracy.byPropertyType[propertyType] || this.currentModel.accuracy.overall
      }
    };
  }

  /**
   * Apply validation bounds to prevent unrealistic price predictions
   */
  private applyValidationBounds(price: number, propertyType: string, unitSize: number): number {
    // Define realistic price ranges based on actual market data analysis
    const validationBounds = {
      HDB: {
        pricePerSqft: { min: 300, max: 1600 },
        totalPrice: { min: 200000, max: 2000000 }
      },
      Condo: {
        pricePerSqft: { min: 800, max: 3500 },
        totalPrice: { min: 600000, max: 6000000 }
      },
      Landed: {
        pricePerSqft: { min: 1200, max: 4000 },
        totalPrice: { min: 2000000, max: 15000000 }
      }
    };

    const bounds = validationBounds[propertyType as keyof typeof validationBounds];
    if (!bounds) {
      console.warn(`[TRAINING] ⚠️ Unknown property type: ${propertyType}, skipping validation`);
      return price;
    }

    // Calculate price per sqft
    const pricePerSqft = price / unitSize;
    
    // Check if price per sqft is within bounds
    let adjustedPricePerSqft = pricePerSqft;
    let wasAdjusted = false;
    
    if (pricePerSqft < bounds.pricePerSqft.min) {
      adjustedPricePerSqft = bounds.pricePerSqft.min;
      wasAdjusted = true;
      console.warn(`[TRAINING] ⚠️ Price per sqft too low: $${pricePerSqft.toFixed(0)} -> $${adjustedPricePerSqft} for ${propertyType}`);
    } else if (pricePerSqft > bounds.pricePerSqft.max) {
      adjustedPricePerSqft = bounds.pricePerSqft.max;
      wasAdjusted = true;
      console.warn(`[TRAINING] ⚠️ Price per sqft too high: $${pricePerSqft.toFixed(0)} -> $${adjustedPricePerSqft} for ${propertyType}`);
    }
    
    // Calculate adjusted total price
    let adjustedPrice = adjustedPricePerSqft * unitSize;
    
    // Also check total price bounds
    if (adjustedPrice < bounds.totalPrice.min) {
      adjustedPrice = bounds.totalPrice.min;
      wasAdjusted = true;
      console.warn(`[TRAINING] ⚠️ Total price too low: $${price.toLocaleString()} -> $${adjustedPrice.toLocaleString()} for ${propertyType}`);
    } else if (adjustedPrice > bounds.totalPrice.max) {
      adjustedPrice = bounds.totalPrice.max;
      wasAdjusted = true;
      console.warn(`[TRAINING] ⚠️ Total price too high: $${price.toLocaleString()} -> $${adjustedPrice.toLocaleString()} for ${propertyType}`);
    }
    
    if (wasAdjusted) {
      console.log(`[TRAINING] 🔧 Applied validation bounds for ${propertyType}: $${price.toLocaleString()} -> $${adjustedPrice.toLocaleString()}`);
    }
    
    return adjustedPrice;
  }

  /**
   * Stop the service
   */
  stop(): void {
    console.log('[TRAINING] Model Training Service stopped');
  }
}

export const modelTrainingService = new ModelTrainingService();