import { Request, Response } from 'express';
import { AreaController } from '../AreaController';
import { DatabaseConnection } from '../../database/connection';
import { AreaRepository } from '../../repositories/AreaRepository';

// Mock the database connection and repository
jest.mock('../../database/connection');
jest.mock('../../repositories/AreaRepository');

describe('AreaController', () => {
  let areaController: AreaController;
  let mockDb: jest.Mocked<DatabaseConnection>;
  let mockAreaRepository: jest.Mocked<AreaRepository>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockDb = new DatabaseConnection() as jest.Mocked<DatabaseConnection>;
    mockAreaRepository = new AreaRepository(mockDb) as jest.Mocked<AreaRepository>;
    areaController = new AreaController(mockDb);
    
    // Replace the repository instance with our mock
    (areaController as any).areaRepository = mockAreaRepository;

    mockRequest = {};
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchAreas', () => {
    it('should return areas when valid query is provided', async () => {
      const mockAreas = [
        {
          id: '1',
          name: 'Orchard',
          district: 'District 9',
          postalCodes: ['228001', '228002'],
          latitude: 1.3048,
          longitude: 103.8318,
          boundaries: '{"type":"Polygon","coordinates":[[[103.8280,1.3010],[103.8360,1.3010],[103.8360,1.3090],[103.8280,1.3090],[103.8280,1.3010]]]}',
          mrtProximity: 0.1,
          cbdDistance: 2.2,
          amenityScore: 9.5,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRequest.query = { query: 'Orchard' };
      mockAreaRepository.searchByQuery.mockResolvedValue(mockAreas);

      await areaController.searchAreas(mockRequest as Request, mockResponse as Response);

      expect(mockAreaRepository.searchByQuery).toHaveBeenCalledWith({
        query: 'Orchard',
        district: undefined,
        postalCode: undefined
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            name: 'Orchard',
            district: 'District 9'
          })
        ]),
        message: 'Found 1 areas'
      });
    });

    it('should return 400 error when no search parameters provided', async () => {
      mockRequest.query = {};

      await areaController.searchAreas(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'At least one search parameter (query, district, or postalCode) is required'
      });
    });

    it('should search by district when district parameter is provided', async () => {
      const mockAreas = [
        {
          id: '1',
          name: 'Orchard',
          district: 'District 9',
          postalCodes: ['228001'],
          latitude: 1.3048,
          longitude: 103.8318,
          boundaries: '{}',
          mrtProximity: 0.1,
          cbdDistance: 2.2,
          amenityScore: 9.5,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRequest.query = { district: 'District 9' };
      mockAreaRepository.findByDistrict.mockResolvedValue(mockAreas);

      await areaController.searchAreas(mockRequest as Request, mockResponse as Response);

      expect(mockAreaRepository.findByDistrict).toHaveBeenCalledWith('District 9');
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([expect.objectContaining({ district: 'District 9' })])
      }));
    });
  });

  describe('validateCoordinates', () => {
    it('should return area when valid coordinates are provided', async () => {
      const mockArea = {
        id: '1',
        name: 'Orchard',
        district: 'District 9',
        postalCodes: ['228001'],
        latitude: 1.3048,
        longitude: 103.8318,
        boundaries: '{"type":"Polygon","coordinates":[]}',
        mrtProximity: 0.1,
        cbdDistance: 2.2,
        amenityScore: 9.5,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRequest.body = {
        coordinates: { latitude: 1.3048, longitude: 103.8318 }
      };
      mockAreaRepository.validateCoordinates.mockResolvedValue(mockArea);

      await areaController.validateCoordinates(mockRequest as Request, mockResponse as Response);

      expect(mockAreaRepository.validateCoordinates).toHaveBeenCalledWith({
        latitude: 1.3048,
        longitude: 103.8318
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: '1',
          name: 'Orchard'
        }),
        message: 'Coordinates are within Orchard, District 9'
      });
    });

    it('should return 400 error when coordinates are missing', async () => {
      mockRequest.body = {};

      await areaController.validateCoordinates(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Coordinates are required'
      });
    });

    it('should return 400 error when coordinates are outside Singapore bounds', async () => {
      mockRequest.body = {
        coordinates: { latitude: 2.0, longitude: 105.0 } // Outside Singapore
      };

      await areaController.validateCoordinates(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Coordinates are outside Singapore boundaries',
        message: 'Valid ranges: latitude 1.0-1.5, longitude 103.0-104.5'
      });
    });

    it('should return 404 when no area found for coordinates', async () => {
      mockRequest.body = {
        coordinates: { latitude: 1.3048, longitude: 103.8318 }
      };
      mockAreaRepository.validateCoordinates.mockResolvedValue(null);

      await areaController.validateCoordinates(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'No area found for the given coordinates',
        message: 'The coordinates may be in water, restricted areas, or outside covered regions'
      });
    });
  });

  describe('getDistricts', () => {
    it('should return list of districts', async () => {
      const mockDistricts = ['District 1', 'District 9', 'District 10'];
      mockAreaRepository.getDistinctDistricts.mockResolvedValue(mockDistricts);

      await areaController.getDistricts(mockRequest as Request, mockResponse as Response);

      expect(mockAreaRepository.getDistinctDistricts).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockDistricts,
        message: 'Found 3 districts'
      });
    });
  });

  describe('getNearbyAreas', () => {
    it('should return nearby areas when valid coordinates provided', async () => {
      const mockAreas = [
        {
          id: '1',
          name: 'Orchard',
          district: 'District 9',
          postalCodes: ['228001'],
          latitude: 1.3048,
          longitude: 103.8318,
          boundaries: '{}',
          mrtProximity: 0.1,
          cbdDistance: 2.2,
          amenityScore: 9.5,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRequest.query = { latitude: '1.3048', longitude: '103.8318', radius: '2' };
      mockAreaRepository.findNearbyAreas.mockResolvedValue(mockAreas);

      await areaController.getNearbyAreas(mockRequest as Request, mockResponse as Response);

      expect(mockAreaRepository.findNearbyAreas).toHaveBeenCalledWith(1.3048, 103.8318, 2);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([expect.objectContaining({ name: 'Orchard' })]),
        message: 'Found 1 areas within 2km'
      });
    });

    it('should return 400 error when coordinates are missing', async () => {
      mockRequest.query = {};

      await areaController.getNearbyAreas(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Latitude and longitude are required'
      });
    });
  });

  describe('getAreaById', () => {
    it('should return area when valid ID provided', async () => {
      const mockArea = {
        id: '1',
        name: 'Orchard',
        district: 'District 9',
        postalCodes: ['228001'],
        latitude: 1.3048,
        longitude: 103.8318,
        boundaries: '{}',
        mrtProximity: 0.1,
        cbdDistance: 2.2,
        amenityScore: 9.5,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRequest.params = { id: '1' };
      mockAreaRepository.findById.mockResolvedValue(mockArea);

      await areaController.getAreaById(mockRequest as Request, mockResponse as Response);

      expect(mockAreaRepository.findById).toHaveBeenCalledWith('1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: '1',
          name: 'Orchard'
        })
      });
    });

    it('should return 404 when area not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      mockAreaRepository.findById.mockResolvedValue(null);

      await areaController.getAreaById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Area not found'
      });
    });
  });
});