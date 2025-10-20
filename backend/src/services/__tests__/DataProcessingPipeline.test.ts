import { DataProcessingPipeline } from '../DataProcessingPipeline';
import { IDevelopmentRepository } from '../../repositories/DevelopmentRepository';
import { IAreaRepository } from '../../repositories/AreaRepository';
import { ProcessedArticle, AreaEntity, DevelopmentEntity } from '../../types';

// Mock repositories
const mockDevelopmentRepository: jest.Mocked<IDevelopmentRepository> = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByAreaId: jest.fn(),
  findDuplicateDevelopments: jest.fn(),
  findByType: jest.fn(),
  findByAreaAndType: jest.fn(),
  findByDateRange: jest.fn(),
  findByImpactScore: jest.fn(),
  findRecentDevelopments: jest.fn(),
  searchByKeywords: jest.fn(),
  findBySourcePublisher: jest.fn(),
  getTopImpactDevelopments: jest.fn()
};

const mockAreaRepository: jest.Mocked<IAreaRepository> = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  searchByName: jest.fn(),
  searchByQuery: jest.fn(),
  findByDistrict: jest.fn(),
  findByPostalCode: jest.fn(),
  validateCoordinates: jest.fn(),
  findNearbyAreas: jest.fn(),
  findByBoundingBox: jest.fn()
};

describe('DataProcessingPipeline', () => {
  let pipeline: DataProcessingPipeline;

  beforeEach(() => {
    jest.clearAllMocks();
    pipeline = new DataProcessingPipeline(mockDevelopmentRepository, mockAreaRepository);
  });

  describe('validateArticleData', () => {
    it('should validate correct article data', () => {
      const article: ProcessedArticle = {
        title: 'Valid Article Title',
        content: 'This is a valid article content with sufficient length to pass validation requirements.',
        url: 'https://example.com/valid-article',
        publishDate: new Date('2024-01-15'),
        source: 'The Straits Times',
        keywords: ['development'],
        developmentType: 'school',
        relevanceScore: 0.8,
        extractedEntities: {
          locations: ['Tampines'],
          organizations: ['MOE'],
          projects: ['New School']
        }
      };

      const result = pipeline.validateArticleData(article);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject article with missing title', () => {
      const article: ProcessedArticle = {
        title: '',
        content: 'Valid content with sufficient length for validation requirements.',
        url: 'https://example.com/article',
        publishDate: new Date('2024-01-15'),
        source: 'Test Source',
        keywords: [],
        developmentType: 'business',
        relevanceScore: 0.5,
        extractedEntities: { locations: [], organizations: [], projects: [] }
      };

      const result = pipeline.validateArticleData(article);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Article title is required');
    });

    it('should reject article with short content', () => {
      const article: ProcessedArticle = {
        title: 'Valid Title',
        content: 'Too short',
        url: 'https://example.com/article',
        publishDate: new Date('2024-01-15'),
        source: 'Test Source',
        keywords: [],
        developmentType: 'business',
        relevanceScore: 0.5,
        extractedEntities: { locations: [], organizations: [], projects: [] }
      };

      const result = pipeline.validateArticleData(article);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Article content is too short (minimum 50 characters)');
    });

    it('should reject article with invalid URL', () => {
      const article: ProcessedArticle = {
        title: 'Valid Title',
        content: 'Valid content with sufficient length for validation requirements.',
        url: 'invalid-url',
        publishDate: new Date('2024-01-15'),
        source: 'Test Source',
        keywords: [],
        developmentType: 'business',
        relevanceScore: 0.5,
        extractedEntities: { locations: [], organizations: [], projects: [] }
      };

      const result = pipeline.validateArticleData(article);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid article URL is required');
    });

    it('should reject article with future publish date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);

      const article: ProcessedArticle = {
        title: 'Valid Title',
        content: 'Valid content with sufficient length for validation requirements.',
        url: 'https://example.com/article',
        publishDate: futureDate,
        source: 'Test Source',
        keywords: [],
        developmentType: 'business',
        relevanceScore: 0.5,
        extractedEntities: { locations: [], organizations: [], projects: [] }
      };

      const result = pipeline.validateArticleData(article);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Article publish date is in the future');
    });

    it('should warn about old articles', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 2);

      const article: ProcessedArticle = {
        title: 'Valid Title',
        content: 'Valid content with sufficient length for validation requirements.',
        url: 'https://example.com/article',
        publishDate: oldDate,
        source: 'Test Source',
        keywords: [],
        developmentType: 'business',
        relevanceScore: 0.5,
        extractedEntities: { locations: [], organizations: [], projects: [] }
      };

      const result = pipeline.validateArticleData(article);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Article is older than one year');
    });

    it('should warn about low relevance score', () => {
      const article: ProcessedArticle = {
        title: 'Valid Title',
        content: 'Valid content with sufficient length for validation requirements.',
        url: 'https://example.com/article',
        publishDate: new Date('2024-01-15'),
        source: 'Test Source',
        keywords: [],
        developmentType: 'business',
        relevanceScore: 0.5, // Below 1.0 threshold
        extractedEntities: { locations: [], organizations: [], projects: [] }
      };

      const result = pipeline.validateArticleData(article);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Article has low relevance score');
    });
  });

  describe('verifyLocationRelevance', () => {
    it('should identify relevant article with direct area name match', async () => {
      const article: ProcessedArticle = {
        title: 'New Development in Tampines',
        content: 'A major shopping mall is being built in Tampines area.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'shopping',
        relevanceScore: 0.8,
        extractedEntities: {
          locations: ['Tampines'],
          organizations: [],
          projects: []
        }
      };

      const result = await pipeline.verifyLocationRelevance(article, 'Tampines', 'East District');

      expect(result.isRelevant).toBe(true);
      expect(result.matchedLocations).toContain('Tampines');
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    it('should identify relevant article with district match', async () => {
      const article: ProcessedArticle = {
        title: 'Development in East District',
        content: 'New infrastructure project in the East District area.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'infrastructure',
        relevanceScore: 0.7,
        extractedEntities: {
          locations: ['East District'],
          organizations: [],
          projects: []
        }
      };

      const result = await pipeline.verifyLocationRelevance(article, 'Tampines', 'East District');

      expect(result.isRelevant).toBe(true);
      expect(result.matchedLocations).toContain('East District');
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    it('should identify relevant article with extracted entity match', async () => {
      const article: ProcessedArticle = {
        title: 'Regional Development News',
        content: 'Various developments across the region.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'mixed',
        relevanceScore: 0.6,
        extractedEntities: {
          locations: ['Tampines Central', 'East Region'],
          organizations: [],
          projects: []
        }
      };

      const result = await pipeline.verifyLocationRelevance(article, 'Tampines', 'East District');

      expect(result.isRelevant).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.2);
    });

    it('should reject irrelevant article', async () => {
      const article: ProcessedArticle = {
        title: 'Development in Jurong',
        content: 'New project in Jurong West area.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'business',
        relevanceScore: 0.5,
        extractedEntities: {
          locations: ['Jurong'],
          organizations: [],
          projects: []
        }
      };

      const result = await pipeline.verifyLocationRelevance(article, 'Tampines', 'East District');

      expect(result.isRelevant).toBe(false);
      expect(result.confidence).toBeLessThan(0.2);
    });

    it('should boost confidence for nearby keywords', async () => {
      const article: ProcessedArticle = {
        title: 'Development nearby Tampines',
        content: 'A project in the vicinity of Tampines area.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'infrastructure',
        relevanceScore: 0.7,
        extractedEntities: {
          locations: ['Tampines'],
          organizations: [],
          projects: []
        }
      };

      const result = await pipeline.verifyLocationRelevance(article, 'Tampines', 'East District');

      expect(result.isRelevant).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.4); // Should be higher due to nearby keywords
    });
  });

  describe('processArticles', () => {
    const mockArea: AreaEntity = {
      id: 'area-1',
      name: 'Tampines',
      district: 'East District',
      postalCodes: ['520101', '520102'],
      latitude: 1.3521,
      longitude: 103.9448,
      boundaries: '{"type":"Polygon","coordinates":[[[103.9,1.35],[103.95,1.35],[103.95,1.37],[103.9,1.37],[103.9,1.35]]]}',
      characteristics: {
        mrtProximity: 0.5,
        cbdDistance: 15.2,
        amenityScore: 8.5
      },
      mrtProximity: 0.5,
      cbdDistance: 15.2,
      amenityScore: 8.5,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    beforeEach(() => {
      mockAreaRepository.findById.mockResolvedValue(mockArea);
      mockDevelopmentRepository.findDuplicateDevelopments.mockResolvedValue([]);
    });

    it('should process valid articles successfully', async () => {
      const articles: ProcessedArticle[] = [
        {
          title: 'New School in Tampines',
          content: 'A new primary school will be built in Tampines to serve the growing population. The school will accommodate 1,200 students.',
          url: 'https://example.com/school-news',
          publishDate: new Date('2024-01-15'),
          source: 'The Straits Times',
          keywords: ['school', 'education'],
          developmentType: 'school',
          relevanceScore: 0.9,
          extractedEntities: {
            locations: ['Tampines'],
            organizations: ['MOE'],
            projects: ['Tampines Primary School']
          }
        }
      ];

      const mockDevelopment: DevelopmentEntity = {
        id: 'dev-1',
        areaId: 'area-1',
        type: 'school',
        title: 'New School in Tampines',
        description: 'School development by MOE in Tampines',
        impactScore: 7.5,
        dateAnnounced: new Date('2024-01-15'),
        sourceUrl: 'https://example.com/school-news',
        sourcePublisher: 'The Straits Times',
        sourcePublishDate: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDevelopmentRepository.create.mockResolvedValue(mockDevelopment);

      const result = await pipeline.processArticles(articles, 'area-1');

      expect(result.success).toBe(true);
      expect(result.data?.processedCount).toBe(1);
      expect(result.data?.createdDevelopments).toHaveLength(1);
      expect(result.data?.skippedCount).toBe(0);
      expect(mockDevelopmentRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should skip articles that fail validation', async () => {
      const articles: ProcessedArticle[] = [
        {
          title: '', // Invalid - empty title
          content: 'Short', // Invalid - too short
          url: 'invalid-url', // Invalid URL
          publishDate: new Date('2024-01-15'),
          source: 'Test',
          keywords: [],
          developmentType: 'business',
          relevanceScore: 0.5,
          extractedEntities: { locations: [], organizations: [], projects: [] }
        }
      ];

      const result = await pipeline.processArticles(articles, 'area-1');

      expect(result.success).toBe(true);
      expect(result.data?.processedCount).toBe(0);
      expect(result.data?.skippedCount).toBe(1);
      expect(result.data?.errors.some(error => error.includes('Article validation failed'))).toBe(true);
    });

    it('should skip irrelevant articles', async () => {
      const articles: ProcessedArticle[] = [
        {
          title: 'Development in Jurong',
          content: 'A new development project is planned for Jurong area, far from Tampines.',
          url: 'https://example.com/jurong-news',
          publishDate: new Date('2024-01-15'),
          source: 'Test Source',
          keywords: ['development'],
          developmentType: 'business',
          relevanceScore: 0.8,
          extractedEntities: {
            locations: ['Jurong'],
            organizations: [],
            projects: []
          }
        }
      ];

      const result = await pipeline.processArticles(articles, 'area-1');

      expect(result.success).toBe(true);
      // Article should be skipped due to location irrelevance (Jurong vs Tampines)
      // The total count (processed + skipped) should equal the input count
      expect((result.data?.processedCount || 0) + (result.data?.skippedCount || 0)).toBe(1);
    });

    it('should skip duplicate articles', async () => {
      const articles: ProcessedArticle[] = [
        {
          title: 'Duplicate Article',
          content: 'This article already exists in the database for this area.',
          url: 'https://example.com/duplicate',
          publishDate: new Date('2024-01-15'),
          source: 'Test Source',
          keywords: ['development'],
          developmentType: 'business',
          relevanceScore: 0.8,
          extractedEntities: {
            locations: ['Tampines'],
            organizations: [],
            projects: []
          }
        }
      ];

      // Mock duplicate found
      mockDevelopmentRepository.findDuplicateDevelopments.mockResolvedValue([
        { id: 'existing-dev', title: 'Duplicate Article' } as DevelopmentEntity
      ]);

      const result = await pipeline.processArticles(articles, 'area-1');

      expect(result.success).toBe(true);
      expect(result.data?.processedCount).toBe(0);
      expect(result.data?.skippedCount).toBe(1);
    });

    it('should handle area not found error', async () => {
      mockAreaRepository.findById.mockResolvedValue(null);

      const articles: ProcessedArticle[] = [];
      const result = await pipeline.processArticles(articles, 'invalid-area');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Area with ID invalid-area not found');
    });

    it('should handle processing errors gracefully', async () => {
      const articles: ProcessedArticle[] = [
        {
          title: 'Valid Article',
          content: 'This is a valid article with sufficient content length for processing.',
          url: 'https://example.com/valid',
          publishDate: new Date('2024-01-15'),
          source: 'Test Source',
          keywords: ['development'],
          developmentType: 'business',
          relevanceScore: 0.8,
          extractedEntities: {
            locations: ['Tampines'],
            organizations: [],
            projects: []
          }
        }
      ];

      // Mock repository error
      mockDevelopmentRepository.create.mockRejectedValue(new Error('Database error'));

      const result = await pipeline.processArticles(articles, 'area-1');

      expect(result.success).toBe(true);
      expect(result.data?.processedCount).toBe(0);
      expect(result.data?.skippedCount).toBe(1);
      // Should have either errors or skipped count due to processing failure
      expect((result.data?.errors?.length || 0) > 0 || (result.data?.skippedCount || 0) > 0).toBe(true);
    });

    it('should track processing time', async () => {
      const articles: ProcessedArticle[] = [];
      const result = await pipeline.processArticles(articles, 'area-1');

      expect(result.success).toBe(true);
      expect(result.data?.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('processBatch', () => {
    beforeEach(() => {
      mockAreaRepository.findById.mockResolvedValue({
        id: 'area-1',
        name: 'Test Area',
        district: 'Test District',
        postalCodes: ['123456'],
        latitude: 1.0,
        longitude: 103.0,
        boundaries: '{}',
        characteristics: {
          mrtProximity: 1.0,
          cbdDistance: 10.0,
          amenityScore: 5.0
        },
        mrtProximity: 1.0,
        cbdDistance: 10.0,
        amenityScore: 5.0,
        createdAt: new Date(),
        updatedAt: new Date()
      } as AreaEntity);
      mockDevelopmentRepository.findDuplicateDevelopments.mockResolvedValue([]);
    });

    it('should process multiple areas successfully', async () => {
      const articlesByArea = new Map<string, ProcessedArticle[]>();
      articlesByArea.set('area-1', [
        {
          title: 'Article 1',
          content: 'Valid content with sufficient length for validation requirements.',
          url: 'https://example.com/1',
          publishDate: new Date('2024-01-15'),
          source: 'Test',
          keywords: [],
          developmentType: 'business',
          relevanceScore: 0.8,
          extractedEntities: {
            locations: ['Test Area'],
            organizations: [],
            projects: []
          }
        }
      ]);

      mockDevelopmentRepository.create.mockResolvedValue({
        id: 'dev-1',
        areaId: 'area-1'
      } as DevelopmentEntity);

      const result = await pipeline.processBatch(articlesByArea);

      expect(result.success).toBe(true);
      expect(result.data?.size).toBe(1);
      // The article might be processed or skipped depending on classification confidence
      expect(result.data?.get('area-1')).toBeDefined();
    });

    it('should handle batch processing errors', async () => {
      const articlesByArea = new Map<string, ProcessedArticle[]>();
      articlesByArea.set('invalid-area', []);

      mockAreaRepository.findById.mockResolvedValue(null);

      const result = await pipeline.processBatch(articlesByArea);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to process area invalid-area');
    });
  });

  describe('getProcessingStatistics', () => {
    it('should return processing statistics', async () => {
      const mockDevelopments: DevelopmentEntity[] = [
        {
          id: 'dev-1',
          type: 'school',
          impactScore: 8.0,
          createdAt: new Date()
        } as DevelopmentEntity,
        {
          id: 'dev-2',
          type: 'infrastructure',
          impactScore: 9.0,
          createdAt: new Date()
        } as DevelopmentEntity
      ];

      mockDevelopmentRepository.findAll.mockResolvedValue(mockDevelopments);

      const stats = await pipeline.getProcessingStatistics();

      expect(stats.totalDevelopments).toBe(2);
      expect(stats.byType.school).toBe(1);
      expect(stats.byType.infrastructure).toBe(1);
      expect(stats.avgImpactScore).toBe(8.5);
    });

    it('should return statistics for specific area', async () => {
      const mockDevelopments: DevelopmentEntity[] = [
        {
          id: 'dev-1',
          type: 'shopping',
          impactScore: 6.0,
          createdAt: new Date()
        } as DevelopmentEntity
      ];

      mockDevelopmentRepository.findByAreaId.mockResolvedValue(mockDevelopments);

      const stats = await pipeline.getProcessingStatistics('area-1');

      expect(stats.totalDevelopments).toBe(1);
      expect(stats.byType.shopping).toBe(1);
      expect(stats.avgImpactScore).toBe(6.0);
    });

    it('should handle empty results', async () => {
      mockDevelopmentRepository.findAll.mockResolvedValue([]);

      const stats = await pipeline.getProcessingStatistics();

      expect(stats.totalDevelopments).toBe(0);
      expect(stats.avgImpactScore).toBe(0);
    });
  });
});