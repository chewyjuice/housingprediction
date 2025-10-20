import { Development, HistoricalPriceEntity, Area, DevelopmentEntity } from '../../types';
import { HistoricalPriceAnalyzer, HistoricalAnalysisResult, AreaCharacteristics, LinearRegressionModel } from './HistoricalPriceAnalyzer';
import { IDevelopmentRepository } from '../../repositories/DevelopmentRepository';

export interface DevelopmentImpactScore {
  developmentId: string;
  type: 'school' | 'infrastructure' | 'shopping' | 'business';
  impactWeight: number;
  timeToCompletion: number; // months
  proximityScore: number; // 0-1 based on distance to area
  significanceScore: number; // 0-1 based on development size/importance
  totalImpact: number; // Combined impact score
}

export interface PredictionFeatures {
  historicalTrend: number;
  developmentImpact: number;
  areaCharacteristics: number;
  marketSentiment: number;
  seasonality: number;
}

export interface EnsemblePrediction {
  predictedPrice: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  modelWeights: {
    historical: number;
    development: number;
    characteristics: number;
    sentiment: number;
  };
  influencingFactors: {
    developmentId: string;
    impactWeight: number;
    description: string;
  }[];
  explanation: string;
  confidence: number; // 0-1 overall confidence score
}

export interface BootstrapSample {
  prediction: number;
  confidence: number;
  features: PredictionFeatures;
}

export class EnsemblePredictionModel {
  constructor(
    private historicalAnalyzer: HistoricalPriceAnalyzer,
    private developmentRepository: IDevelopmentRepository
  ) {}

  /**
   * Generate ensemble prediction combining multiple approaches
   */
  public async generateEnsemblePrediction(
    areaId: string,
    area: Area,
    timeframeYears: number,
    propertyType: 'HDB' | 'Condo' | 'Landed' = 'Condo'
  ): Promise<EnsemblePrediction> {
    // Get historical analysis
    const historicalAnalysis = await this.historicalAnalyzer.analyzeHistoricalTrends(areaId, propertyType);
    
    // Get development impact scores
    const developmentImpacts = await this.calculateDevelopmentImpacts(areaId, timeframeYears);
    
    // Get enhanced area characteristics
    const areaCharacteristics = await this.historicalAnalyzer.getEnhancedAreaCharacteristics(area);
    
    // Build prediction features
    const features = this.buildPredictionFeatures(
      historicalAnalysis,
      developmentImpacts,
      areaCharacteristics,
      timeframeYears
    );

    // Generate multiple model predictions
    const historicalPrediction = this.generateHistoricalPrediction(historicalAnalysis, timeframeYears);
    const developmentPrediction = this.generateDevelopmentBasedPrediction(
      historicalAnalysis.priceTrends[historicalAnalysis.priceTrends.length - 1]?.price || 0,
      developmentImpacts,
      timeframeYears
    );
    const characteristicsPrediction = this.generateCharacteristicsBasedPrediction(
      historicalAnalysis.priceTrends[historicalAnalysis.priceTrends.length - 1]?.price || 0,
      areaCharacteristics,
      timeframeYears
    );

    // Calculate model weights based on data quality and confidence
    const modelWeights = this.calculateModelWeights(historicalAnalysis, developmentImpacts, areaCharacteristics);

    // Combine predictions using weighted ensemble
    const ensemblePrediction = this.combineModelPredictions(
      historicalPrediction,
      developmentPrediction,
      characteristicsPrediction,
      modelWeights
    );

    // Calculate confidence intervals using bootstrap sampling
    const confidenceInterval = await this.calculateConfidenceInterval(
      areaId,
      area,
      timeframeYears,
      propertyType,
      100 // bootstrap samples
    );

    // Generate influencing factors and explanation
    const influencingFactors = this.generateInfluencingFactors(developmentImpacts);
    const explanation = this.generatePredictionExplanation(
      ensemblePrediction,
      modelWeights,
      developmentImpacts,
      historicalAnalysis
    );

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(
      historicalAnalysis,
      developmentImpacts,
      modelWeights
    );

    return {
      predictedPrice: Math.round(ensemblePrediction),
      confidenceInterval,
      modelWeights,
      influencingFactors,
      explanation,
      confidence: overallConfidence
    };
  }

  /**
   * Calculate development impact scores for the area
   */
  private async calculateDevelopmentImpacts(
    areaId: string,
    timeframeYears: number
  ): Promise<DevelopmentImpactScore[]> {
    // Get developments in the area from the last 12 months and future projects
    const developmentEntities = await this.developmentRepository.findByAreaId(areaId);
    const developments = developmentEntities.map(entity => this.convertDevelopmentEntityToDevelopment(entity));
    
    const impactScores: DevelopmentImpactScore[] = [];
    const currentDate = new Date();
    const futureDate = new Date();
    futureDate.setFullYear(currentDate.getFullYear() + timeframeYears);

    for (const development of developments) {
      // Calculate time to completion
      const completionDate = development.expectedCompletion || development.dateAnnounced;
      const timeToCompletion = Math.max(0, 
        (new Date(completionDate).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );

      // Skip developments that are too far in the future
      if (timeToCompletion > timeframeYears * 12) {
        continue;
      }

      // Calculate impact weight based on development type
      const typeWeights = {
        'school': 0.8,
        'infrastructure': 1.0,
        'shopping': 0.6,
        'business': 0.7
      };

      const baseWeight = typeWeights[development.type] || 0.5;
      
      // Adjust weight based on existing impact score from development
      const impactWeight = baseWeight * (development.impactScore / 10); // Normalize impact score

      // Calculate proximity score (simplified - in real system would use actual distances)
      const proximityScore = 0.8; // Assume developments are relevant to the area

      // Calculate significance score based on description length and keywords
      const significanceScore = this.calculateSignificanceScore(development);

      // Calculate total impact with time decay
      const timeDecayFactor = Math.max(0.1, 1 - (timeToCompletion / (timeframeYears * 12)));
      const totalImpact = impactWeight * proximityScore * significanceScore * timeDecayFactor;

      impactScores.push({
        developmentId: development.id,
        type: development.type,
        impactWeight,
        timeToCompletion,
        proximityScore,
        significanceScore,
        totalImpact
      });
    }

    // Sort by total impact descending
    return impactScores.sort((a, b) => b.totalImpact - a.totalImpact);
  }

  /**
   * Calculate significance score for a development
   */
  private calculateSignificanceScore(development: Development): number {
    const description = development.description.toLowerCase();
    const title = development.title.toLowerCase();
    
    // Keywords that indicate high significance
    const highImpactKeywords = [
      'mrt', 'station', 'mall', 'hospital', 'university', 'school', 'highway',
      'expressway', 'bridge', 'interchange', 'development', 'complex', 'center'
    ];
    
    const mediumImpactKeywords = [
      'park', 'clinic', 'office', 'retail', 'residential', 'commercial'
    ];

    let score = 0.3; // Base score
    
    // Check for high impact keywords
    for (const keyword of highImpactKeywords) {
      if (description.includes(keyword) || title.includes(keyword)) {
        score += 0.15;
      }
    }
    
    // Check for medium impact keywords
    for (const keyword of mediumImpactKeywords) {
      if (description.includes(keyword) || title.includes(keyword)) {
        score += 0.08;
      }
    }
    
    // Bonus for longer, more detailed descriptions
    if (description.length > 200) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Build prediction features from all data sources
   */
  private buildPredictionFeatures(
    historicalAnalysis: HistoricalAnalysisResult,
    developmentImpacts: DevelopmentImpactScore[],
    areaCharacteristics: AreaCharacteristics,
    timeframeYears: number
  ): PredictionFeatures {
    // Historical trend feature (normalized annual growth rate)
    const historicalTrend = Math.max(-0.5, Math.min(0.5, historicalAnalysis.averageAnnualGrowth / 100));
    
    // Development impact feature (sum of all development impacts)
    const developmentImpact = Math.min(1.0, 
      developmentImpacts.reduce((sum, impact) => sum + impact.totalImpact, 0) / 5
    );
    
    // Area characteristics feature (weighted combination)
    const areaCharacteristicsScore = (
      areaCharacteristics.mrtProximity * 0.3 +
      areaCharacteristics.cbdDistance * 0.2 +
      areaCharacteristics.amenityScore * 0.2 +
      areaCharacteristics.transportationScore * 0.15 +
      areaCharacteristics.commercialScore * 0.15
    );
    
    // Market sentiment (simplified - based on recent price trends)
    const recentTrends = historicalAnalysis.priceTrends.slice(-6); // Last 6 months
    const marketSentiment = recentTrends.length > 0 
      ? recentTrends.filter(t => t.trend === 'increasing').length / recentTrends.length
      : 0.5;
    
    // Seasonality (simplified - could be enhanced with actual seasonal patterns)
    const currentMonth = new Date().getMonth();
    const seasonality = 0.5 + 0.1 * Math.sin((currentMonth / 12) * 2 * Math.PI); // Simple seasonal adjustment
    
    return {
      historicalTrend,
      developmentImpact,
      areaCharacteristics: areaCharacteristicsScore,
      marketSentiment,
      seasonality
    };
  }

  /**
   * Generate prediction based on historical trends
   */
  private generateHistoricalPrediction(
    historicalAnalysis: HistoricalAnalysisResult,
    timeframeYears: number
  ): number {
    const monthsInFuture = timeframeYears * 12;
    const prediction = this.historicalAnalyzer.predictPrice(
      historicalAnalysis.regressionModel,
      monthsInFuture
    );
    
    return prediction.predictedPrice;
  }

  /**
   * Generate prediction based on development impacts
   */
  private generateDevelopmentBasedPrediction(
    currentPrice: number,
    developmentImpacts: DevelopmentImpactScore[],
    timeframeYears: number
  ): number {
    if (currentPrice <= 0) return 0;
    
    // Calculate total development impact over the timeframe
    const totalImpact = developmentImpacts.reduce((sum, impact) => {
      // Apply time-based weighting for when the development will be completed
      const completionFactor = impact.timeToCompletion <= (timeframeYears * 12) ? 1.0 : 0.5;
      return sum + (impact.totalImpact * completionFactor);
    }, 0);
    
    // Convert impact to price multiplier (conservative approach)
    const impactMultiplier = 1 + (totalImpact * 0.15); // Max 15% impact per unit of total impact
    
    return currentPrice * impactMultiplier;
  }

  /**
   * Generate prediction based on area characteristics
   */
  private generateCharacteristicsBasedPrediction(
    currentPrice: number,
    areaCharacteristics: AreaCharacteristics,
    timeframeYears: number
  ): number {
    if (currentPrice <= 0) return 0;
    
    // Calculate characteristics-based growth rate
    const characteristicsScore = (
      areaCharacteristics.mrtProximity * 0.25 +
      areaCharacteristics.cbdDistance * 0.2 +
      areaCharacteristics.amenityScore * 0.2 +
      areaCharacteristics.developmentDensity * 0.15 +
      areaCharacteristics.transportationScore * 0.1 +
      areaCharacteristics.commercialScore * 0.1
    );
    
    // Convert to annual growth rate (0.5 = 0%, 1.0 = 10% annual growth)
    const annualGrowthRate = (characteristicsScore - 0.5) * 0.2; // Max 10% growth for perfect score
    
    // Apply compound growth
    const growthMultiplier = Math.pow(1 + annualGrowthRate, timeframeYears);
    
    return currentPrice * growthMultiplier;
  }

  /**
   * Calculate model weights based on data quality and confidence
   */
  private calculateModelWeights(
    historicalAnalysis: HistoricalAnalysisResult,
    developmentImpacts: DevelopmentImpactScore[],
    areaCharacteristics: AreaCharacteristics
  ): { historical: number; development: number; characteristics: number; sentiment: number } {
    // Base weights
    let historicalWeight = 0.4;
    let developmentWeight = 0.3;
    let characteristicsWeight = 0.2;
    let sentimentWeight = 0.1;
    
    // Adjust based on data quality
    const dataQuality = historicalAnalysis.dataQuality.completeness;
    const rSquared = historicalAnalysis.regressionModel.rSquared;
    
    // Increase historical weight if we have good historical data
    if (dataQuality > 0.8 && rSquared > 0.7) {
      historicalWeight += 0.1;
      developmentWeight -= 0.05;
      characteristicsWeight -= 0.05;
    }
    
    // Increase development weight if we have many significant developments
    const significantDevelopments = developmentImpacts.filter(d => d.totalImpact > 0.3).length;
    if (significantDevelopments > 2) {
      developmentWeight += 0.1;
      historicalWeight -= 0.05;
      characteristicsWeight -= 0.05;
    }
    
    // Normalize weights to sum to 1
    const totalWeight = historicalWeight + developmentWeight + characteristicsWeight + sentimentWeight;
    
    return {
      historical: historicalWeight / totalWeight,
      development: developmentWeight / totalWeight,
      characteristics: characteristicsWeight / totalWeight,
      sentiment: sentimentWeight / totalWeight
    };
  }

  /**
   * Combine model predictions using weighted ensemble
   */
  private combineModelPredictions(
    historicalPrediction: number,
    developmentPrediction: number,
    characteristicsPrediction: number,
    weights: { historical: number; development: number; characteristics: number; sentiment: number }
  ): number {
    // For sentiment, use average of other predictions as baseline
    const sentimentPrediction = (historicalPrediction + developmentPrediction + characteristicsPrediction) / 3;
    
    const ensemblePrediction = 
      historicalPrediction * weights.historical +
      developmentPrediction * weights.development +
      characteristicsPrediction * weights.characteristics +
      sentimentPrediction * weights.sentiment;
    
    return Math.max(0, ensemblePrediction);
  }

  /**
   * Calculate confidence intervals using bootstrap sampling
   */
  private async calculateConfidenceInterval(
    areaId: string,
    area: Area,
    timeframeYears: number,
    propertyType: 'HDB' | 'Condo' | 'Landed',
    bootstrapSamples: number = 100
  ): Promise<{ lower: number; upper: number }> {
    const samples: number[] = [];
    
    // Generate bootstrap samples with slight variations
    for (let i = 0; i < bootstrapSamples; i++) {
      try {
        // Add small random variations to simulate uncertainty
        const variation = 1 + (Math.random() - 0.5) * 0.1; // ±5% variation
        
        // Get a slightly modified prediction
        const samplePrediction = await this.generateEnsemblePrediction(
          areaId,
          area,
          timeframeYears,
          propertyType
        );
        
        samples.push(samplePrediction.predictedPrice * variation);
      } catch (error) {
        // Skip failed samples
        continue;
      }
    }
    
    if (samples.length === 0) {
      // Fallback if no samples generated
      const basePrediction = await this.generateEnsemblePrediction(areaId, area, timeframeYears, propertyType);
      return {
        lower: basePrediction.predictedPrice * 0.85,
        upper: basePrediction.predictedPrice * 1.15
      };
    }
    
    // Sort samples and calculate percentiles
    samples.sort((a, b) => a - b);
    
    const lowerIndex = Math.floor(samples.length * 0.025); // 2.5th percentile
    const upperIndex = Math.floor(samples.length * 0.975); // 97.5th percentile
    
    return {
      lower: Math.round(samples[lowerIndex]),
      upper: Math.round(samples[upperIndex])
    };
  }

  /**
   * Generate influencing factors from development impacts
   */
  private generateInfluencingFactors(
    developmentImpacts: DevelopmentImpactScore[]
  ): { developmentId: string; impactWeight: number; description: string }[] {
    return developmentImpacts
      .filter(impact => impact.totalImpact > 0.1) // Only significant impacts
      .slice(0, 5) // Top 5 factors
      .map(impact => ({
        developmentId: impact.developmentId,
        impactWeight: Math.round(impact.totalImpact * 100) / 100,
        description: this.getImpactDescription(impact)
      }));
  }

  /**
   * Get description for development impact
   */
  private getImpactDescription(impact: DevelopmentImpactScore): string {
    const typeDescriptions = {
      'school': 'Educational facility development',
      'infrastructure': 'Infrastructure improvement',
      'shopping': 'Commercial retail development',
      'business': 'Business district expansion'
    };
    
    const baseDescription = typeDescriptions[impact.type] || 'Development project';
    const timeframe = impact.timeToCompletion <= 12 ? 'near-term' : 'long-term';
    const significance = impact.significanceScore > 0.7 ? 'major' : 'moderate';
    
    return `${significance} ${baseDescription} (${timeframe} completion)`;
  }

  /**
   * Generate prediction explanation
   */
  private generatePredictionExplanation(
    prediction: number,
    weights: { historical: number; development: number; characteristics: number; sentiment: number },
    developmentImpacts: DevelopmentImpactScore[],
    historicalAnalysis: HistoricalAnalysisResult
  ): string {
    const parts: string[] = [];
    
    // Historical component
    if (weights.historical > 0.3) {
      const growth = historicalAnalysis.averageAnnualGrowth;
      parts.push(`Historical trends show ${growth > 0 ? 'positive' : 'negative'} growth of ${Math.abs(growth).toFixed(1)}% annually`);
    }
    
    // Development component
    const significantDevelopments = developmentImpacts.filter(d => d.totalImpact > 0.2).length;
    if (weights.development > 0.2 && significantDevelopments > 0) {
      parts.push(`${significantDevelopments} significant development${significantDevelopments > 1 ? 's' : ''} expected to impact prices`);
    }
    
    // Characteristics component
    if (weights.characteristics > 0.15) {
      parts.push(`Area characteristics support price appreciation`);
    }
    
    // Confidence indicator
    const confidence = Math.round(
      (historicalAnalysis.regressionModel.rSquared * weights.historical +
       (significantDevelopments / 5) * weights.development +
       0.7 * weights.characteristics) * 100
    );
    
    parts.push(`Prediction confidence: ${confidence}%`);
    
    return parts.join('. ') + '.';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    historicalAnalysis: HistoricalAnalysisResult,
    developmentImpacts: DevelopmentImpactScore[],
    weights: { historical: number; development: number; characteristics: number; sentiment: number }
  ): number {
    // Historical confidence based on R-squared and data quality
    const historicalConfidence = historicalAnalysis.regressionModel.rSquared * historicalAnalysis.dataQuality.completeness;
    
    // Development confidence based on number and quality of developments
    const developmentConfidence = Math.min(1.0, developmentImpacts.length / 3) * 0.8;
    
    // Characteristics confidence (fixed high value as these are known)
    const characteristicsConfidence = 0.9;
    
    // Sentiment confidence (lower as it's more uncertain)
    const sentimentConfidence = 0.6;
    
    // Weighted average
    const overallConfidence = 
      historicalConfidence * weights.historical +
      developmentConfidence * weights.development +
      characteristicsConfidence * weights.characteristics +
      sentimentConfidence * weights.sentiment;
    
    return Math.round(overallConfidence * 100) / 100;
  }

  /**
   * Convert DevelopmentEntity to Development domain model
   */
  private convertDevelopmentEntityToDevelopment(entity: DevelopmentEntity): Development {
    return {
      id: entity.id,
      areaId: entity.areaId,
      type: entity.type,
      title: entity.title,
      description: entity.description,
      impactScore: entity.impactScore,
      dateAnnounced: entity.dateAnnounced,
      expectedCompletion: entity.expectedCompletion,
      source: {
        url: entity.sourceUrl,
        publisher: entity.sourcePublisher,
        publishDate: entity.sourcePublishDate
      }
    };
  }
}