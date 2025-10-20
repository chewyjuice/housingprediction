import { AreaRepository } from '../AreaRepository';
import { DatabaseConnection } from '../../database/connection';
import { AreaEntity, AreaSearchQuery } from '../../types';

// Mock the database connection
jest.mock('../../database/connection');

describe('AreaRepository', () => {
  let areaRepository: AreaRepository;
  let mockDb: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(),
      close: jest.fn(),
    } as any;
    
    areaRepository = new AreaRepository(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchByName', () => {
    it('should search areas by name using text search', async () => {
      const mockAreas: AreaEntity[] = [
        {
          id: '1',
          name: 'Orchard Road',
          district: 'District 9',
          postalCodes: ['238801', '238802'],
          latitude: 1.3048,
          longitude: 103.8318,
          boundaries: '{"type":"Polygon","coordinates":[[[103.8,1.3],[103.85,1.3],[103.85,1.31],[103.8,1.31],[103.8,1.3]]]}',
          characteristics: {
            mrtProximity: 0.2,
            cbdDistance: 2.5,
            amenityScore: 9.5,
          },
          mrtProximity: 0.2,
          cbdDistance: 2.5,
          amenityScore: 9.5,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockAreas } as any);

      const result = await areaRepository.searchByName('Orchard');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('to_tsvector'),
        ['Orchard', '%Orchard%', 'Orchard']
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Orchard Road');
    });

    it('should return empty array when no areas match search', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await areaRepository.searchByName('NonExistent');

      expect(result).toHaveLength(0);
    });
  });

  describe('validateCoordinates', () => {
    it('should return null for coordinates outside Singapore bounds', async () => {
      const invalidCoordinates = { latitude: 2.0, longitude: 105.0 };

      const result = await areaRepository.validateCoordinates(invalidCoordinates);

      expect(result).toBeNull();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should find nearest area for valid Singapore coordinates', async () => {
      const validCoordinates = { latitude: 1.3048, longitude: 103.8318 };
      const mockArea: AreaEntity & { distance: number } = {
        id: '1',
        name: 'Orchard Road',
        district: 'District 9',
        postalCodes: ['238801'],
        latitude: 1.3048,
        longitude: 103.8318,
        boundaries: '{"type":"Polygon","coordinates":[[[103.8,1.3],[103.85,1.3],[103.85,1.31],[103.8,1.31],[103.8,1.3]]]}',
        characteristics: {
          mrtProximity: 0.2,
          cbdDistance: 2.5,
          amenityScore: 9.5,
        },
        mrtProximity: 0.2,
        cbdDistance: 2.5,
        amenityScore: 9.5,
        createdAt: new Date(),
        updatedAt: new Date(),
        distance: 0.1
      };

      mockDb.query.mockResolvedValue({ rows: [mockArea] } as any);

      const result = await areaRepository.validateCoordinates(validCoordinates);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('6371 * acos'),
        [validCoordinates.latitude, validCoordinates.longitude]
      );
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Orchard Road');
    });

    it('should return null when nearest area is too far away', async () => {
      const validCoordinates = { latitude: 1.3048, longitude: 103.8318 };
      const mockArea = {
        id: '1',
        name: 'Far Area',
        distance: 5.0 // > 2km threshold
      };

      mockDb.query.mockResolvedValue({ rows: [mockArea] } as any);

      const result = await areaRepository.validateCoordinates(validCoordinates);

      expect(result).toBeNull();
    });
  });

  describe('searchByQuery', () => {
    it('should search areas with multiple filters', async () => {
      const searchQuery: AreaSearchQuery = {
        query: 'Orchard',
        district: 'District 9',
        postalCode: '238801'
      };

      const mockAreas: AreaEntity[] = [
        {
          id: '1',
          name: 'Orchard Road',
          district: 'District 9',
          postalCodes: ['238801'],
          latitude: 1.3048,
          longitude: 103.8318,
          boundaries: '{"type":"Polygon","coordinates":[]}',
          characteristics: {
            mrtProximity: 0.2,
            cbdDistance: 2.5,
            amenityScore: 9.5,
          },
          mrtProximity: 0.2,
          cbdDistance: 2.5,
          amenityScore: 9.5,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockAreas } as any);

      const result = await areaRepository.searchByQuery(searchQuery);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE 1=1'),
        ['Orchard', '%Orchard%', 'District 9', '238801']
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findByDistrict', () => {
    it('should find areas by district', async () => {
      const mockAreas: AreaEntity[] = [
        {
          id: '1',
          name: 'Area 1',
          district: 'District 9',
          postalCodes: ['238801'],
          latitude: 1.3048,
          longitude: 103.8318,
          boundaries: '{"type":"Polygon","coordinates":[]}',
          characteristics: {
            mrtProximity: 0.2,
            cbdDistance: 2.5,
            amenityScore: 9.5,
          },
          mrtProximity: 0.2,
          cbdDistance: 2.5,
          amenityScore: 9.5,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockAreas } as any);

      const result = await areaRepository.findByDistrict('District 9');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE district = $1'),
        ['District 9']
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findNearbyAreas', () => {
    it('should find areas within specified radius', async () => {
      const mockAreas = [
        {
          id: '1',
          name: 'Nearby Area',
          latitude: 1.3048,
          longitude: 103.8318,
          distance: 1.5
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockAreas } as any);

      const result = await areaRepository.findNearbyAreas(1.3048, 103.8318, 2.0);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('6371 * acos'),
        [1.3048, 103.8318, 2.0]
      );
      expect(result).toHaveLength(1);
    });
  });
});