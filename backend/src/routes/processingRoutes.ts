import { Router } from 'express';
import { ProcessingController } from '../controllers/ProcessingController';
import { DatabaseConnection } from '../database/connection';

export function createProcessingRoutes(db: DatabaseConnection): Router {
  const router = Router();
  const processingController = new ProcessingController(db);

  // Process articles for a specific area
  router.post('/process', processingController.processArticles);

  // Process articles for multiple areas in batch
  router.post('/process/batch', processingController.processBatch);

  // Get processing statistics
  router.get('/statistics', processingController.getStatistics);

  // Reprocess articles for an area
  router.post('/reprocess/:areaId', processingController.reprocessArticles);

  // Clean up old development records
  router.post('/cleanup/:areaId', processingController.cleanupDevelopments);

  return router;
}