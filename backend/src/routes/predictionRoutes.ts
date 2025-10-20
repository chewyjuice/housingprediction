import { Router } from 'express';
import { PredictionController } from '../controllers/PredictionController';
import { PredictionService } from '../services/PredictionService';
import { 
  PredictionRepository,
  AreaRepository,
  HistoricalPriceRepository,
  DevelopmentRepository,
  DatabaseConnection
} from '../repositories';

export function createPredictionRoutes(db: DatabaseConnection): Router {
  const router = Router();

  // Initialize dependencies
  const predictionRepository = new PredictionRepository(db);
  const areaRepository = new AreaRepository(db);
  const historicalPriceRepository = new HistoricalPriceRepository(db);
  const developmentRepository = new DevelopmentRepository(db);

  const predictionService = new PredictionService(
    predictionRepository,
    areaRepository,
    historicalPriceRepository,
    developmentRepository
  );

  const predictionController = new PredictionController(predictionService);

  // Routes
  router.post('/request', predictionController.createPredictionRequest);
  router.get('/request/:requestId', predictionController.getPredictionResult);
  router.post('/process/:requestId', predictionController.processPrediction);
  router.get('/history', predictionController.getPredictionHistory);
  router.get('/statistics/:areaId', predictionController.getPredictionStatistics);
  router.get('/health', predictionController.getHealthStatus);
  router.post('/validate', predictionController.validatePredictionRequest);

  return router;
}