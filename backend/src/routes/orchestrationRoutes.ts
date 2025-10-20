import { Router } from 'express';
import { OrchestrationController } from '../controllers/OrchestrationController';
import { DatabaseConnection } from '../database/connection';
import { ServiceRegistry } from '../services/ServiceRegistry';
import { validateFields, validateTimeframe } from '../middleware/validation';

export function createOrchestrationRoutes(
  db: DatabaseConnection, 
  serviceRegistry: ServiceRegistry
): Router {
  const router = Router();
  const orchestrationController = new OrchestrationController(db, serviceRegistry);

  // Execute full prediction workflow
  router.post('/predict/full', 
    validateFields(['areaId', 'timeframeYears']),
    validateTimeframe,
    orchestrationController.executeFullPrediction
  );

  // Execute quick prediction (using cached data)
  router.post('/predict/quick',
    validateFields(['areaId', 'timeframeYears']),
    validateTimeframe,
    orchestrationController.executeQuickPrediction
  );

  // Get orchestration statistics
  router.get('/statistics', orchestrationController.getStatistics);

  // Check services health
  router.get('/health', orchestrationController.checkHealth);

  // Get monitoring dashboard data
  router.get('/dashboard', orchestrationController.getDashboard);

  // Get service metrics
  router.get('/metrics/:serviceName', orchestrationController.getServiceMetrics);

  // Trigger health check for specific service
  router.post('/health/:serviceName', orchestrationController.checkServiceHealth);

  return router;
}