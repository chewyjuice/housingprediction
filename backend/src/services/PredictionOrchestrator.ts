import { ServiceRegistry } from './ServiceRegistry';
import { CrawlerService } from './CrawlerService';
import { ProcessingService, ProcessingJobData } from './ProcessingService';
import { PredictionService } from './PredictionService';
import { DatabaseConnection } from '../database/connection';
import { AreaRepository } from '../repositories/AreaRepository';
import { DevelopmentRepository } from '../repositories/DevelopmentRepository';
import { PredictionRepository } from '../repositories/PredictionRepository';
import { HistoricalPriceRepository } from '../repositories/HistoricalPriceRepository';
import { PredictionRequest, PredictionResult, Area, AreaEntity } from '../types';

export interface OrchestrationResult {
  success: boolean;
  data?: {
    predictionResult: PredictionResult;
    crawlingStats: {
      articlesFound: number;
      processingTime: number;
    };
    processingStats: {
      developmentsExtracted: number;
      processingTime: number;
    };
    predictionStats: {
      modelUsed: string;
      confidence: number;
      processingTime: number;
    };
  };
  error?: string;
}

export interface OrchestrationStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
}

/**
 * Orchestrates the complete prediction workflow across multiple services
 */
export class PredictionOrchestrator {
  private serviceRegistry: ServiceRegistry;
  private crawlerService: CrawlerService;
  private processingService: ProcessingService;
  public predictionService: PredictionService; // Make public for controller access
  private areaRepository: AreaRepository;

  constructor(db: DatabaseConnection, serviceRegistry: ServiceRegistry) {
    this.serviceRegistry = serviceRegistry;
    
    // Initialize repositories
    this.areaRepository = new AreaRepository(db);
    const developmentRepository = new DevelopmentRepository(db);
    const predictionRepository = new PredictionRepository(db);
    const historicalPriceRepository = new HistoricalPriceRepository(db);
    
    // Initialize services
    this.crawlerService = new CrawlerService(developmentRepository);
    this.processingService = new ProcessingService(developmentRepository, this.areaRepository);
    this.predictionService = new PredictionService(
      predictionRepository, 
      this.areaRepository, 
      historicalPriceRepository, 
      developmentRepository
    );
  }

  /**
   * Execute the complete prediction workflow
   */
  public async executePredictionWorkflow(
    predictionRequest: PredictionRequest,
    onStepUpdate?: (step: OrchestrationStep) => void
  ): Promise<OrchestrationResult> {
    const steps: OrchestrationStep[] = [
      { name: 'validate-area', status: 'pending' },
      { name: 'crawl-data', status: 'pending' },
      { name: 'process-data', status: 'pending' },
      { name: 'generate-prediction', status: 'pending' }
    ];

    try {
      // Step 1: Validate area
      const validateStep = steps[0];
      this.updateStep(validateStep, 'running', onStepUpdate);
      
      const areaEntity = await this.validateArea(predictionRequest.areaId);
      if (!areaEntity) {
        throw new Error(`Area with ID ${predictionRequest.areaId} not found`);
      }
      
      this.updateStep(validateStep, 'completed', onStepUpdate);

      // Step 2: Crawl data
      const crawlStep = steps[1];
      this.updateStep(crawlStep, 'running', onStepUpdate);
      
      const crawlStartTime = Date.now();
      // Start crawler job and wait for completion (simplified for now)
      const jobId = await this.crawlerService.addCrawlerJob(areaEntity.name, areaEntity.id);
      const crawlingTime = Date.now() - crawlStartTime;
      
      this.updateStep(crawlStep, 'completed', onStepUpdate);

      // Step 3: Process data (simplified - in real implementation, would get crawler results)
      const processStep = steps[2];
      this.updateStep(processStep, 'running', onStepUpdate);
      
      const processStartTime = Date.now();
      // For now, skip actual processing since we'd need to wait for crawler job completion
      const processingTime = Date.now() - processStartTime;
      
      this.updateStep(processStep, 'completed', onStepUpdate);

      // Step 4: Generate prediction
      const predictionStep = steps[3];
      this.updateStep(predictionStep, 'running', onStepUpdate);
      
      const predictionStartTime = Date.now();
      const predictionResult = await this.predictionService.processPredictionRequest(
        predictionRequest.id
      );
      const predictionTime = Date.now() - predictionStartTime;
      
      if (!predictionResult.success) {
        throw new Error(`Prediction failed: ${predictionResult.error}`);
      }
      
      this.updateStep(predictionStep, 'completed', onStepUpdate);

      // Return orchestration result
      return {
        success: true,
        data: {
          predictionResult: predictionResult.result!,
          crawlingStats: {
            articlesFound: 0, // Would be populated from crawler results
            processingTime: crawlingTime
          },
          processingStats: {
            developmentsExtracted: 0, // Would be populated from processing results
            processingTime: processingTime
          },
          predictionStats: {
            modelUsed: 'ensemble',
            confidence: predictionResult.result?.confidenceInterval ? 
              Math.abs(predictionResult.result.confidenceInterval.upper - predictionResult.result.confidenceInterval.lower) / 
              (2 * predictionResult.result.predictedPrice) : 0,
            processingTime: predictionTime
          }
        }
      };

    } catch (error: any) {
      // Mark current running step as failed
      const runningStep = steps.find(step => step.status === 'running');
      if (runningStep) {
        this.updateStep(runningStep, 'failed', onStepUpdate, error.message);
      }

      console.error('Prediction workflow failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a simplified prediction workflow using cached data
   */
  public async executeQuickPrediction(predictionRequest: PredictionRequest): Promise<OrchestrationResult> {
    try {
      // Validate area
      const areaEntity = await this.validateArea(predictionRequest.areaId);
      if (!areaEntity) {
        throw new Error(`Area with ID ${predictionRequest.areaId} not found`);
      }

      // Generate prediction using existing data
      const predictionStartTime = Date.now();
      const predictionResult = await this.predictionService.processPredictionRequest(
        predictionRequest.id
      );
      const predictionTime = Date.now() - predictionStartTime;

      if (!predictionResult.success) {
        throw new Error(`Prediction failed: ${predictionResult.error}`);
      }

      return {
        success: true,
        data: {
          predictionResult: predictionResult.result!,
          crawlingStats: {
            articlesFound: 0,
            processingTime: 0
          },
          processingStats: {
            developmentsExtracted: 0,
            processingTime: 0
          },
          predictionStats: {
            modelUsed: 'ensemble-cached',
            confidence: predictionResult.result?.confidenceInterval ? 
              Math.abs(predictionResult.result.confidenceInterval.upper - predictionResult.result.confidenceInterval.lower) / 
              (2 * predictionResult.result.predictedPrice) : 0,
            processingTime: predictionTime
          }
        }
      };

    } catch (error: any) {
      console.error('Quick prediction failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if services are healthy before orchestration
   */
  public async checkServicesHealth(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // Check database connection
      const dbHealthy = await this.testDatabaseConnection();
      if (!dbHealthy) {
        issues.push('Database connection failed');
      }

      // Check external services
      const serviceHealth = await this.serviceRegistry.checkAllServicesHealth();
      const unhealthyServices = serviceHealth.filter(service => service.status !== 'healthy');
      
      for (const service of unhealthyServices) {
        issues.push(`Service ${service.name} is ${service.status}: ${service.error || 'Unknown error'}`);
      }

      return {
        healthy: issues.length === 0,
        issues
      };

    } catch (error: any) {
      issues.push(`Health check failed: ${error.message}`);
      return {
        healthy: false,
        issues
      };
    }
  }

  /**
   * Get orchestration statistics
   */
  public async getOrchestrationStats(): Promise<{
    totalPredictions: number;
    averageProcessingTime: number;
    successRate: number;
    serviceHealth: any[];
  }> {
    try {
      // Get service health
      const serviceHealth = await this.serviceRegistry.checkAllServicesHealth();

      // For now, return basic stats - in a real implementation, you'd track these metrics
      return {
        totalPredictions: 0, // Would be tracked in a metrics store
        averageProcessingTime: 0, // Would be calculated from request logs
        successRate: 100, // Would be calculated from success/failure ratios
        serviceHealth
      };

    } catch (error: any) {
      console.error('Failed to get orchestration stats:', error);
      return {
        totalPredictions: 0,
        averageProcessingTime: 0,
        successRate: 0,
        serviceHealth: []
      };
    }
  }

  /**
   * Validate area exists and is valid
   */
  private async validateArea(areaId: string): Promise<AreaEntity | null> {
    try {
      return await this.areaRepository.findById(areaId);
    } catch (error) {
      console.error('Area validation failed:', error);
      return null;
    }
  }

  /**
   * Test database connection
   */
  private async testDatabaseConnection(): Promise<boolean> {
    try {
      // Use a simple query to test connection
      await this.areaRepository.count();
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Update step status and notify callback
   */
  private updateStep(
    step: OrchestrationStep, 
    status: OrchestrationStep['status'], 
    onStepUpdate?: (step: OrchestrationStep) => void,
    error?: string
  ): void {
    const now = new Date();
    
    if (status === 'running') {
      step.startTime = now;
    } else if (status === 'completed' || status === 'failed') {
      step.endTime = now;
      if (step.startTime) {
        step.duration = now.getTime() - step.startTime.getTime();
      }
    }
    
    step.status = status;
    if (error) {
      step.error = error;
    }
    
    if (onStepUpdate) {
      onStepUpdate(step);
    }
  }
}