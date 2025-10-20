import { Request, Response } from 'express';
import { AreaRepository } from '../repositories/AreaRepository';
import { DatabaseConnection } from '../database/connection';
import { AreaSearchQuery, AreaValidationRequest, ApiResponse, AreaEntity, Area } from '../types';
import CacheService from '../services/CacheService';

export class AreaController {
  private areaRepository: AreaRepository;
  private cacheService: CacheService;

  constructor(db: DatabaseConnection) {
    this.areaRepository = new AreaRepository(db);
    this.cacheService = new CacheService();
  }

  /**
   * GET /api/areas/search
   * Search for areas by name, district, or postal code
   */
  public searchAreas = async (req: Request, res: Response): Promise<void> => {
    try {
      const { query, district, postalCode, limit = '20' } = req.query;

      // Validate query parameters
      if (!query && !district && !postalCode) {
        res.status(400).json({
          success: false,
          error: 'At least one search parameter (query, district, or postalCode) is required'
        } as ApiResponse<never>);
        return;
      }

      // Create cache key for the search
      const cacheKey = `${query || ''}_${district || ''}_${postalCode || ''}`;
      
      // Check cache first
      const cachedResults = await this.cacheService.getCachedAreaSearch(cacheKey);
      if (cachedResults) {
        const limitNum = Math.min(parseInt(limit as string) || 20, 50);
        const limitedAreas = cachedResults.slice(0, limitNum);
        
        res.json({
          success: true,
          data: limitedAreas,
          message: `Found ${limitedAreas.length} areas (cached)`
        } as ApiResponse<Area[]>);
        return;
      }

      // Build search query
      const searchQuery: AreaSearchQuery = {
        query: query as string || '',
        district: district as string,
        postalCode: postalCode as string
      };

      let areas: AreaEntity[];

      if (searchQuery.query) {
        // Use the enhanced search method for text queries
        areas = await this.areaRepository.searchByQuery(searchQuery);
      } else if (searchQuery.district) {
        // Search by district
        areas = await this.areaRepository.findByDistrict(searchQuery.district);
      } else if (searchQuery.postalCode) {
        // Search by postal code
        areas = await this.areaRepository.findByPostalCode(searchQuery.postalCode);
      } else {
        areas = [];
      }

      // Transform to frontend format
      const transformedAreas = areas.map(this.transformAreaEntity);

      // Cache the results for 30 minutes
      await this.cacheService.cacheAreaSearch(cacheKey, transformedAreas, 1800);

      // Apply limit
      const limitNum = Math.min(parseInt(limit as string) || 20, 50);
      const limitedAreas = transformedAreas.slice(0, limitNum);

      res.json({
        success: true,
        data: limitedAreas,
        message: `Found ${limitedAreas.length} areas`
      } as ApiResponse<Area[]>);

    } catch (error) {
      console.error('Error searching areas:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while searching areas'
      } as ApiResponse<never>);
    }
  };

  /**
   * POST /api/areas/validate
   * Validate coordinates and return the area they belong to
   */
  public validateCoordinates = async (req: Request, res: Response): Promise<void> => {
    try {
      const validationRequest: AreaValidationRequest = req.body;

      // Validate request body
      if (!validationRequest.coordinates) {
        res.status(400).json({
          success: false,
          error: 'Coordinates are required'
        } as ApiResponse<never>);
        return;
      }

      const { latitude, longitude } = validationRequest.coordinates;

      // Validate coordinate format
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Latitude and longitude must be numbers'
        } as ApiResponse<never>);
        return;
      }

      // Validate Singapore bounds
      if (latitude < 1.0 || latitude > 1.5 || longitude < 103.0 || longitude > 104.5) {
        res.status(400).json({
          success: false,
          error: 'Coordinates are outside Singapore boundaries',
          message: 'Valid ranges: latitude 1.0-1.5, longitude 103.0-104.5'
        } as ApiResponse<never>);
        return;
      }

      // Find area containing the coordinates
      const area = await this.areaRepository.validateCoordinates({ latitude, longitude });

      if (!area) {
        res.status(404).json({
          success: false,
          error: 'No area found for the given coordinates',
          message: 'The coordinates may be in water, restricted areas, or outside covered regions'
        } as ApiResponse<never>);
        return;
      }

      // Transform to frontend format
      const transformedArea = this.transformAreaEntity(area);

      res.json({
        success: true,
        data: transformedArea,
        message: `Coordinates are within ${area.name}, ${area.district}`
      } as ApiResponse<typeof transformedArea>);

    } catch (error) {
      console.error('Error validating coordinates:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while validating coordinates'
      } as ApiResponse<never>);
    }
  };

  /**
   * GET /api/areas/districts
   * Get list of all available districts
   */
  public getDistricts = async (req: Request, res: Response): Promise<void> => {
    try {
      const districts = await this.areaRepository.getDistinctDistricts();

      res.json({
        success: true,
        data: districts,
        message: `Found ${districts.length} districts`
      } as ApiResponse<string[]>);

    } catch (error) {
      console.error('Error fetching districts:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching districts'
      } as ApiResponse<never>);
    }
  };

  /**
   * GET /api/areas/nearby
   * Find areas near given coordinates within specified radius
   */
  public getNearbyAreas = async (req: Request, res: Response): Promise<void> => {
    try {
      const { latitude, longitude, radius = '2' } = req.query;

      // Validate parameters
      if (!latitude || !longitude) {
        res.status(400).json({
          success: false,
          error: 'Latitude and longitude are required'
        } as ApiResponse<never>);
        return;
      }

      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);
      const radiusKm = Math.min(parseFloat(radius as string) || 2, 10); // Max 10km

      if (isNaN(lat) || isNaN(lng) || isNaN(radiusKm)) {
        res.status(400).json({
          success: false,
          error: 'Invalid coordinate or radius values'
        } as ApiResponse<never>);
        return;
      }

      // Validate Singapore bounds
      if (lat < 1.0 || lat > 1.5 || lng < 103.0 || lng > 104.5) {
        res.status(400).json({
          success: false,
          error: 'Coordinates are outside Singapore boundaries'
        } as ApiResponse<never>);
        return;
      }

      const areas = await this.areaRepository.findNearbyAreas(lat, lng, radiusKm);
      const transformedAreas = areas.map(this.transformAreaEntity);

      res.json({
        success: true,
        data: transformedAreas,
        message: `Found ${transformedAreas.length} areas within ${radiusKm}km`
      } as ApiResponse<typeof transformedAreas>);

    } catch (error) {
      console.error('Error finding nearby areas:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while finding nearby areas'
      } as ApiResponse<never>);
    }
  };

  /**
   * GET /api/areas/:id
   * Get specific area by ID
   */
  public getAreaById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Area ID is required'
        } as ApiResponse<never>);
        return;
      }

      // Check cache first
      const cachedArea = await this.cacheService.getCachedArea(id);
      if (cachedArea) {
        res.json({
          success: true,
          data: cachedArea
        } as ApiResponse<Area>);
        return;
      }

      const area = await this.areaRepository.findById(id);

      if (!area) {
        res.status(404).json({
          success: false,
          error: 'Area not found'
        } as ApiResponse<never>);
        return;
      }

      const transformedArea = this.transformAreaEntity(area);

      // Cache the area for 1 hour
      await this.cacheService.cacheArea(transformedArea, 3600);

      res.json({
        success: true,
        data: transformedArea
      } as ApiResponse<Area>);

    } catch (error) {
      console.error('Error fetching area by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching area'
      } as ApiResponse<never>);
    }
  };

  /**
   * Transform AreaEntity to frontend Area format
   */
  private transformAreaEntity = (entity: AreaEntity) => {
    return {
      id: entity.id,
      name: entity.name,
      district: entity.district,
      postalCodes: entity.postalCodes,
      coordinates: {
        latitude: entity.latitude,
        longitude: entity.longitude,
        boundaries: typeof entity.boundaries === 'string' 
          ? JSON.parse(entity.boundaries) 
          : entity.boundaries
      },
      characteristics: {
        mrtProximity: entity.mrtProximity,
        cbdDistance: entity.cbdDistance,
        amenityScore: entity.amenityScore
      }
    };
  };
}