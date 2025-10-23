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

    return {
      predictedPrice: Math.round(predictedPrice),
      predictedPricePerUnit: Math.round(predictedPrice / unitSize),
      confidenceInterval: {
        lower: Math.round(confidenceInterval.lower),
        upper: Math.round(confidenceInterval.upper),
        lowerPerUnit: Math.round(confidenceInterval.lowerPerUnit),
        upperPerUnit: Math.round(confidenceInterval.upperPerUnit)
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
   * Stop the service
   */
  stop(): void {
    console.log('[TRAINING] Model Training Service stopped');
  }
}

export const modelTrainingService = new ModelTrainingService();