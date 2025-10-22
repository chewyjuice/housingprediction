import { Router } from 'express';
import { DatabaseConnection } from '../database/connection';
import { PerformanceController } from '../controllers/PerformanceController';

export function createPerformanceRoutes(db: DatabaseConnection): Router {
  const router = Router();
  const performanceController = new PerformanceController(db);

  // Performance monitoring endpoints
  router.get('/metrics', performanceController.getMetrics);
  router.get('/health', performanceController.getSystemHealth);
  router.get('/connection-pool', performanceController.getConnectionPoolHealth);
  router.get('/analysis', performanceController.runPerformanceAnalysis);

  // Query performance endpoints
  router.get('/slow-queries', performanceController.getSlowQueries);
  router.post('/analyze-query', performanceController.analyzeQuery);
  router.post('/benchmark-query', performanceController.benchmarkQuery);
  router.get('/query-recommendations', performanceController.getQueryRecommendations);

  // Index optimization endpoints
  router.get('/index-efficiency', performanceController.getIndexEfficiency);
  router.get('/suggest-indexes/:tableName', performanceController.suggestIndexes);

  // Database maintenance endpoints
  router.get('/table-bloat', performanceController.getTableBloat);
  router.post('/optimize', performanceController.optimizeDatabase);

  return router;
}

export default createPerformanceRoutes;