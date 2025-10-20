import { DevelopmentRepository } from '../DevelopmentRepository';
import { DatabaseConnection } from '../../database/connection';
import { DevelopmentEntity } from '../../types';

// Mock the database connection
jest.mock('../../database/connection');

describe('DevelopmentRepository', () => {
  let developmentRepository: DevelopmentRepository;
  let mockDb: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(),
      close: jest.fn(),
    } as any;
    
    developmentRepository = new DevelopmentRepository(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new development record', async () => {
      const newDevelopment = {
        areaId: 'area-1',
        type: 'school' as const,
        title: 'New Primary School',
        description: 'A new primary school in the area',
        impactScore: 8.5,
        dateAnnounced: new Date('2024-01-15'),
        sourceUrl: 'https://example.com/news',
        sourcePublisher: 'The Straits Times',
        sourcePublishDate: new Date('2024-01-15'),
      };

      const mockCreatedDevelopment: DevelopmentEntity = {
        id: 'dev-1',
        ...newDevelopment,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreatedDevelopment] } as any);

      const result = await developmentRepository.create(newDevelopment);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO developments'),
        expect.arrayContaining([
          'area-1',
          'school',
          'New Primary School',
          'A new primary school in the area',
          8.5
        ])
      );
      expect(result.id).toBe('dev-1');
      expect(result.type).toBe('school');
    });
  });

  describe('findByAreaId', () => {
    it('should retrieve developments for a specific area', async () => {
      const mockDevelopments: DevelopmentEntity[] = [
        {
          id: 'dev-1',
          areaId: 'area-1',
          type: 'school',
          title: 'Primary School',
          description: 'New school',
          impactScore: 8.5,
          dateAnnounced: new Date('2024-01-15'),
          sourceUrl: 'https://example.com',
          sourcePublisher: 'ST',
          sourcePublishDate: new Date('2024-01-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockDevelopments } as any);

      const result = await developmentRepository.findByAreaId('area-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE area_id = $1'),
        ['area-1']
      );
      expect(result).toHaveLength(1);
      expect(result[0].areaId).toBe('area-1');
    });

    it('should return empty array when no developments found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await developmentRepository.findByAreaId('nonexistent-area');

      expect(result).toHaveLength(0);
    });
  });

  describe('findByType', () => {
    it('should retrieve developments by type', async () => {
      const mockDevelopments: DevelopmentEntity[] = [
        {
          id: 'dev-1',
          areaId: 'area-1',
          type: 'infrastructure',
          title: 'MRT Station',
          description: 'New MRT station',
          impactScore: 9.0,
          dateAnnounced: new Date('2024-01-15'),
          sourceUrl: 'https://example.com',
          sourcePublisher: 'CNA',
          sourcePublishDate: new Date('2024-01-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockDevelopments } as any);

      const result = await developmentRepository.findByType('infrastructure');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE type = $1'),
        ['infrastructure']
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('infrastructure');
    });
  });

  describe('findByAreaAndType', () => {
    it('should retrieve developments by area and type', async () => {
      const mockDevelopments: DevelopmentEntity[] = [
        {
          id: 'dev-1',
          areaId: 'area-1',
          type: 'shopping',
          title: 'Shopping Mall',
          description: 'New shopping center',
          impactScore: 7.5,
          dateAnnounced: new Date('2024-01-15'),
          sourceUrl: 'https://example.com',
          sourcePublisher: 'PropertyGuru',
          sourcePublishDate: new Date('2024-01-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockDevelopments } as any);

      const result = await developmentRepository.findByAreaAndType('area-1', 'shopping');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE area_id = $1 AND type = $2'),
        ['area-1', 'shopping']
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('shopping');
    });
  });

  describe('findRecentDevelopments', () => {
    it('should retrieve developments from recent months', async () => {
      const mockDevelopments: DevelopmentEntity[] = [
        {
          id: 'dev-1',
          areaId: 'area-1',
          type: 'business',
          title: 'Office Building',
          description: 'New office complex',
          impactScore: 6.5,
          dateAnnounced: new Date('2024-01-15'),
          sourceUrl: 'https://example.com',
          sourcePublisher: 'EdgeProp',
          sourcePublishDate: new Date('2024-01-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockDevelopments } as any);

      const result = await developmentRepository.findRecentDevelopments('area-1', 6);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '6 months'"),
        ['area-1']
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('searchByKeywords', () => {
    it('should search developments by keywords', async () => {
      const mockDevelopments: DevelopmentEntity[] = [
        {
          id: 'dev-1',
          areaId: 'area-1',
          type: 'school',
          title: 'International School',
          description: 'New international school facility',
          impactScore: 8.0,
          dateAnnounced: new Date('2024-01-15'),
          sourceUrl: 'https://example.com',
          sourcePublisher: 'ST',
          sourcePublishDate: new Date('2024-01-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockDevelopments } as any);

      const result = await developmentRepository.searchByKeywords(['school', 'international']);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('to_tsvector'),
        ['school', 'international']
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getTopImpactDevelopments', () => {
    it('should retrieve developments with highest impact scores', async () => {
      const mockDevelopments: DevelopmentEntity[] = [
        {
          id: 'dev-1',
          areaId: 'area-1',
          type: 'infrastructure',
          title: 'MRT Extension',
          description: 'Major transport upgrade',
          impactScore: 9.5,
          dateAnnounced: new Date('2024-01-15'),
          sourceUrl: 'https://example.com',
          sourcePublisher: 'LTA',
          sourcePublishDate: new Date('2024-01-15'),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockDevelopments } as any);

      const result = await developmentRepository.getTopImpactDevelopments('area-1', 5);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY impact_score DESC'),
        ['area-1', 5]
      );
      expect(result).toHaveLength(1);
      expect(result[0].impactScore).toBe(9.5);
    });
  });

  describe('getImpactScoreStatistics', () => {
    it('should calculate impact score statistics for an area', async () => {
      const mockStats = {
        avg_score: 7.5,
        max_score: 9.5,
        min_score: 5.0,
        total_developments: '10'
      };

      mockDb.query.mockResolvedValue({ rows: [mockStats] } as any);

      const result = await developmentRepository.getImpactScoreStatistics('area-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AVG(impact_score)'),
        ['area-1']
      );
      expect(result.avgScore).toBe(7.5);
      expect(result.maxScore).toBe(9.5);
      expect(result.minScore).toBe(5.0);
      expect(result.totalDevelopments).toBe(10);
    });
  });
});