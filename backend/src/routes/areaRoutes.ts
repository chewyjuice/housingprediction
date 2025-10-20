import { Router } from 'express';
import { AreaController } from '../controllers/AreaController';
import { DatabaseConnection } from '../database/connection';

export function createAreaRoutes(db: DatabaseConnection): Router {
  const router = Router();
  const areaController = new AreaController(db);

  // GET /api/areas/search - Search areas by query parameters
  router.get('/search', areaController.searchAreas);

  // POST /api/areas/validate - Validate coordinates and find containing area
  router.post('/validate', areaController.validateCoordinates);

  // GET /api/areas/districts - Get all available districts
  router.get('/districts', areaController.getDistricts);

  // GET /api/areas/nearby - Find areas near coordinates
  router.get('/nearby', areaController.getNearbyAreas);

  // GET /api/areas/:id - Get specific area by ID
  router.get('/:id', areaController.getAreaById);

  return router;
}