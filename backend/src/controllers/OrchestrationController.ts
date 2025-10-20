import { Request, Response } from 'express';
import { PredictionOrchestrator, OrchestrationStep } from '../services/PredictionOrchestrator';
import { ServiceMonitor } from '../services/ServiceMonitor';
import { ServiceRegistry } from '../services/ServiceRegistry';
import { DatabaseConnection } from '../database/connection';
import { PredictionRequest, ApiResponse } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';

export class OrchestrationController {
  private orchestrator: PredictionOrchestrator;
  private monitor: ServiceMonitor;

  constructor(db: DatabaseConnection, serviceRegistry: ServiceRegistry) {
    this.orchestrator = new PredictionOrchestrator(db, serviceRegistry);
    this.monitor = new ServiceMonitor(serviceRegistry, db);
    
    // Start monitoring
    this.monitor.startMonitoring(30000); // Check every 30 seconds
  }

  /**
   * Execute full prediction workflow with data crawling and processing
   */
  public executeFullPrediction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { areaId, timeframeYears } = req.body;
      
      // Create prediction request first
      const createRequest = await this.orchestrator['predictionService'].createPredictionRequest({
        areaId,
        timeframeYears
      }, req.user?.id);
      
      if (!createRequest.success || !createRequest.data) {
        const response: ApiResponse<null> = {
          success: false,
          error: createRequest.error || 'Failed to create prediction request'
        };
        res.status(400).json(response);
        return;
      }
      
      const predictionRequest = createRequest.data;

      // Check services health before starting
      const healthCheck = await this.orchestrator.checkServicesHealth();
      if (!healthCheck.healthy) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Services not ready for prediction',
          message: `Service issues: ${healthCheck.issues.join(', ')}`
        };
        res.status(503).json(response);
        return;
      }

      // Set up Server-Sent Events for real-time updates (optional)
      const stepUpdates: OrchestrationStep[] = [];
      const onStepUpdate = (step: OrchestrationStep) => {
        stepUpdates.push({ ...step });
        console.log(`Orchestration step: ${step.name} - ${step.status}`);
      };

      // Execute workflow
      const result = await this.orchestrator.executePredictionWorkflow(
        predictionRequest,
        onStepUpdate
      );

      this.monitor.incrementRequestCount();

      if (result.success) {
        const response: ApiResponse<any> = {
          success: true,
          data: {
            ...result.data,
            steps: stepUpdates
          },
          message: 'Prediction completed successfully'
        };
        res.status(200).json(response);
      } else {
        this.monitor.incrementErrorCount();
        const response: ApiResponse<null> = {
          success: false,
          error: result.error || 'Prediction workflow failed'
        };
        res.status(500).json(response);
      }

    } catch (error: any) {
      this.monitor.incrementErrorCount();
      console.error('Error in executeFullPrediction:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error during prediction workflow'
      };
      res.status(500).json(response);
    }
  };

  /**
   * Execute quick prediction using cached data
   */
  public executeQuickPrediction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { areaId, timeframeYears } = req.body;
      
      // Create prediction request first
      const createRequest = await this.orchestrator['predictionService'].createPredictionRequest({
        areaId,
        timeframeYears
      }, req.user?.id);
      
      if (!createRequest.success || !createRequest.data) {
        const response: ApiResponse<null> = {
          success: false,
          error: createRequest.error || 'Failed to create prediction request'
        };
        res.status(400).json(response);
        return;
      }
      
      const predictionRequest = createRequest.data;

      const result = await this.orchestrator.executeQuickPrediction(predictionRequest);

      this.monitor.incrementRequestCount();

      if (result.success) {
        const response: ApiResponse<typeof result.data> = {
          success: true,
          data: result.data,
          message: 'Quick prediction completed successfully'
        };
        res.status(200).json(response);
      } else {
        this.monitor.incrementErrorCount();
        const response: ApiResponse<null> = {
          success: false,
          error: result.error || 'Quick prediction failed'
        };
        res.status(500).json(response);
      }

    } catch (error: any) {
      this.monitor.incrementErrorCount();
      console.error('Error in executeQuickPrediction:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error during quick prediction'
      };
      res.status(500).json(response);
    }
  };

  /**
   * Get orchestration statistics
   */
  public getStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.orchestrator.getOrchestrationStats();
      const systemMetrics = this.monitor.getSystemMetrics();
      const serviceMetrics = this.monitor.getAggregatedMetrics(24); // Last 24 hours

      const response: ApiResponse<any> = {
        success: true,
        data: {
          orchestration: stats,
          system: systemMetrics,
          services: serviceMetrics
        }
      };
      res.status(200).json(response);

    } catch (error: any) {
      console.error('Error in getStatistics:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to get orchestration statistics'
      };
      res.status(500).json(response);
    }
  };

  /**
   * Check overall system health
   */
  public checkHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const healthCheck = await this.orchestrator.checkServicesHealth();
      const dbHealth = await this.monitor.checkDatabaseHealth();
      
      const response: ApiResponse<any> = {
        success: true,
        data: {
          overall: healthCheck.healthy ? 'healthy' : 'unhealthy',
          issues: healthCheck.issues,
          database: dbHealth,
          timestamp: new Date().toISOString()
        }
      };
      
      res.status(healthCheck.healthy ? 200 : 503).json(response);

    } catch (error: any) {
      console.error('Error in checkHealth:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Health check failed'
      };
      res.status(503).json(response);
    }
  };

  /**
   * Get monitoring dashboard data
   */
  public getDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const dashboardData = await this.monitor.getDashboardData();
      
      const response: ApiResponse<typeof dashboardData> = {
        success: true,
        data: dashboardData
      };
      res.status(200).json(response);

    } catch (error: any) {
      console.error('Error in getDashboard:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to get dashboard data'
      };
      res.status(500).json(response);
    }
  };

  /**
   * Get metrics for a specific service
   */
  public getServiceMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { serviceName } = req.params;
      const { hours = 24 } = req.query;
      
      const metrics = this.monitor.getServiceMetrics(serviceName, Number(hours));
      
      const response: ApiResponse<typeof metrics> = {
        success: true,
        data: metrics
      };
      res.status(200).json(response);

    } catch (error: any) {
      console.error('Error in getServiceMetrics:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to get service metrics'
      };
      res.status(500).json(response);
    }
  };

  /**
   * Check health of a specific service
   */
  public checkServiceHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const { serviceName } = req.params;
      
      const healthChecks = await this.monitor.performHealthChecks();
      const serviceHealth = healthChecks.find(h => h.name === serviceName);
      
      if (!serviceHealth) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Service not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof serviceHealth> = {
        success: true,
        data: serviceHealth
      };
      res.status(serviceHealth.status === 'healthy' ? 200 : 503).json(response);

    } catch (error: any) {
      console.error('Error in checkServiceHealth:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to check service health'
      };
      res.status(500).json(response);
    }
  };
}