import { ProcessingService, ProcessingJobData } from '../ProcessingService';
import { DataProcessingPipeline } from '../DataProcessingPipeline';
import { ContentProcessor } from '../ContentProcessor';
import { IDevelopmentRepository } from '../../repositories/DevelopmentRepository';
import { IAreaRepository } from '../../repositories/AreaRepository';
import { ArticleData, ProcessedArticle, DevelopmentEntity } from '../../types';

// Mock dependencies
jest.mock('../DataProcessingPipeline');
jest.mock('../ContentProcessor');

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

const MockedDataProcessingPipeline = DataProcessingPipeline as jest.MockedClass<typeof DataProcessingPipeline>;
const MockedContentProcessor = ContentProcessor as jest.MockedClass<typeof ContentProcessor>;

describe('ProcessingService', () => {
  let processingService: ProcessingService;
  let mockPipeline: jest.Mocked<DataProcessingPipeline>;
  let mockContentProcessor: jest.Mocked<ContentProcessor>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPipeline = {
      processArticles: jest.fn(),
      getProcessingStatistics: jest.fn()
    } as any;
    
    mockContentProcessor = {
      filterDevelopmentContent: jest.fn(),
      deduplicateArticles: jest.fn(),
      filterByDateRange: jest.fn(),
      processArticles: jest.fn()
    } as any;

    MockedDataProcessingPipeline.mockImplementation(() => mockPipeline);
    MockedContentProcessor.mockImplementation(() => mockContentProcessor);

    processingService = new ProcessingService(mockDevelopmentRepository, mockAreaRepository);
  });

  describe('validateProcessingJobData', () => {
    it('should validate correct job data', () => {
      const jobData: ProcessingJobData = {
        jobId: 'job-123',
        areaId: 'area-456',
        areaName: 'Tampines',
        articles: [
          {
            title: 'Test Article',
            content: 'Test content',
            url: 'https://example.com',
            source: 'Test Source',
            publishDate: new Date()
          }
        ]
      };

      const result = processingService.validateProcessingJobData(jobData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject job data with missing job ID', () => {
      const jobData: ProcessingJobData = {
        jobId: '',
        areaId: 'area-456',
        areaName: 'Tampines',
        articles: []
      };

      const result = processingService.validateProcessingJobData(jobData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Job ID is required');
    });

    it('should reject job data with missing area ID', () => {
      const jobData: ProcessingJobData = {
        jobId: 'job-123',
        areaId: '',
        areaName: 'Tampines',
        articles: []
      };

      const result = processingService.validateProcessingJobData(jobData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Area ID is required');
    });

    it('should reject job data with missing area name', () => {
      const jobData: ProcessingJobData = {
        jobId: 'job-123',
        areaId: 'area-456',
        areaName: '',
        articles: []
      };

      const result = processingService.validateProcessingJobData(jobData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Area name is required');
    });

    it('should reject job data with empty articles array', () => {
      const jobData: ProcessingJobData = {
        jobId: 'job-123',
        areaId: 'area-456',
        areaName: 'Tampines',
        articles: []
      };

      const result = processingService.validateProcessingJobData(jobData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one article is required');
    });

    it('should reject job data with invalid articles', () => {
      const jobData: ProcessingJobData = {
        jobId: 'job-123',
        areaId: 'area-456',
        areaName: 'Tampines',
        articles: [
          {
            title: '',
            content: '',
            url: '',
            source: '',
            publishDate: new Date()
          }
        ]
      };

      const result = processingService.validateProcessingJobData(jobData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Article 1 is missing required fields (title, content, url, source)');
    });

    it('should validate only first 5 articles for performance', () => {
      const articles: ArticleData[] = [];
      for (let i = 0; i < 10; i++) {
        articles.push({
          title: i < 3 ? '' : 'Valid Title',
          content: 'Valid content',
          url: 'https://example.com',
          source: 'Test Source',
          publishDate: new Date()
        });
      }

      const jobData: ProcessingJobData = {
        jobId: 'job-123',
        areaId: 'area-456',
        areaName: 'Tampines',
        articles
      };

      const result = processingService.validateProcessingJobData(jobData);

      expect(result.isValid).toBe(false);
      // Should only validate first 5 articles, so only 3 errors for empty titles
      expect(result.errors.filter(e => e.includes('missing required fields'))).toHaveLength(3);
    });
  });

  describe('processArticlesForArea', () => {
    const mockJobData: ProcessingJobData = {
      jobId: 'job-123',
      areaId: 'area-456',
      areaName: 'Tampines',
      articles: [
        {
          title: 'New School Development',
          content: 'A new primary school will be built in Tampines area.',
          url: 'https://example.com/school',
          source: 'The Straits Times',
          publishDate: new Date('2024-01-15')
        },
        {
          title: 'Shopping Mall Opens',
          content: 'A new shopping mall opened in Tampines with 100 stores.',
          url: 'https://example.com/mall',
          source: 'Channel NewsAsia',
          publishDate: new Date('2024-02-01')
        }
      ]
    };

    const mockProcessedArticles: ProcessedArticle[] = [
      {
        title: 'New School Development',
        content: 'A new primary school will be built in Tampines area.',
        url: 'https://example.com/school',
        source: 'The Straits Times',
        publishDate: new Date('2024-01-15'),
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

    beforeEach(() => {
      mockContentProcessor.filterDevelopmentContent.mockReturnValue(mockJobData.articles);
      mockContentProcessor.deduplicateArticles.mockReturnValue(mockJobData.articles);
      mockContentProcessor.filterByDateRange.mockReturnValue(mockJobData.articles);
      mockContentProcessor.processArticles.mockReturnValue(mockProcessedArticles);
    });

    it('should process articles successfully', async () => {
      const mockPipelineResult = {
        success: true,
        data: {
          processedCount: 1,
          createdDevelopments: [
            {
              id: 'dev-1',
              areaId: 'area-456',
              type: 'school',
              title: 'New School Development',
              impactScore: 7.5
            } as DevelopmentEntity
          ],
          skippedCount: 1,
          errors: [],
          processingTime: 1500
        }
      };

      mockPipeline.processArticles.mockResolvedValue(mockPipelineResult);

      const result = await processingService.processArticlesForArea(mockJobData);

      expect(result.success).toBe(true);
      expect(result.data?.jobId).toBe('job-123');
      expect(result.data?.areaId).toBe('area-456');
      expect(result.data?.areaName).toBe('Tampines');
      expect(result.data?.processingResult.processedCount).toBe(1);
      expect(result.data?.processedArticles).toEqual(mockProcessedArticles);

      // Verify content processor calls
      expect(mockContentProcessor.filterDevelopmentContent).toHaveBeenCalledWith(mockJobData.articles);
      expect(mockContentProcessor.deduplicateArticles).toHaveBeenCalled();
      expect(mockContentProcessor.filterByDateRange).toHaveBeenCalled();
      expect(mockContentProcessor.processArticles).toHaveBeenCalled();

      // Verify pipeline call
      expect(mockPipeline.processArticles).toHaveBeenCalledWith(mockProcessedArticles, 'area-456');
    });

    it('should handle pipeline processing failure', async () => {
      const mockPipelineResult = {
        success: false,
        error: 'Pipeline processing failed'
      };

      mockPipeline.processArticles.mockResolvedValue(mockPipelineResult);

      const result = await processingService.processArticlesForArea(mockJobData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pipeline processing failed');
    });

    it('should handle processing service errors', async () => {
      mockContentProcessor.filterDevelopmentContent.mockImplementation(() => {
        throw new Error('Content processor error');
      });

      const result = await processingService.processArticlesForArea(mockJobData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Processing service failed');
    });

    it('should filter articles through content processing pipeline', async () => {
      // Mock progressive filtering
      mockContentProcessor.filterDevelopmentContent.mockReturnValue([mockJobData.articles[0]]); // Filter to 1
      mockContentProcessor.deduplicateArticles.mockReturnValue([mockJobData.articles[0]]); // Keep 1
      mockContentProcessor.filterByDateRange.mockReturnValue([mockJobData.articles[0]]); // Keep 1
      mockContentProcessor.processArticles.mockReturnValue([mockProcessedArticles[0]]); // Process 1

      const mockPipelineResult = {
        success: true,
        data: {
          processedCount: 1,
          createdDevelopments: [],
          skippedCount: 0,
          errors: [],
          processingTime: 1000
        }
      };

      mockPipeline.processArticles.mockResolvedValue(mockPipelineResult);

      const result = await processingService.processArticlesForArea(mockJobData);

      expect(result.success).toBe(true);
      
      // Verify filtering pipeline
      expect(mockContentProcessor.filterDevelopmentContent).toHaveBeenCalledWith(mockJobData.articles);
      expect(mockContentProcessor.deduplicateArticles).toHaveBeenCalledWith([mockJobData.articles[0]]);
      expect(mockContentProcessor.filterByDateRange).toHaveBeenCalledWith([mockJobData.articles[0]], expect.any(Date));
      expect(mockContentProcessor.processArticles).toHaveBeenCalledWith([mockJobData.articles[0]]);
    });

    it('should filter articles by 12-month date range', async () => {
      const result = await processingService.processArticlesForArea(mockJobData);

      const filterByDateRangeCall = mockContentProcessor.filterByDateRange.mock.calls[0];
      const dateThreshold = filterByDateRangeCall[1] as Date;
      
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      // Allow for small time differences in test execution
      const timeDiff = Math.abs(dateThreshold.getTime() - twelveMonthsAgo.getTime());
      expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
    });
  });

  describe('processBatchAreas', () => {
    it('should process multiple areas successfully', async () => {
      const batchJobs: ProcessingJobData[] = [
        {
          jobId: 'job-1',
          areaId: 'area-1',
          areaName: 'Tampines',
          articles: [
            {
              title: 'Article 1',
              content: 'Content 1',
              url: 'https://example.com/1',
              source: 'Source 1',
              publishDate: new Date()
            }
          ]
        },
        {
          jobId: 'job-2',
          areaId: 'area-2',
          areaName: 'Jurong',
          articles: [
            {
              title: 'Article 2',
              content: 'Content 2',
              url: 'https://example.com/2',
              source: 'Source 2',
              publishDate: new Date()
            }
          ]
        }
      ];

      // Mock successful processing for both jobs
      mockContentProcessor.filterDevelopmentContent.mockReturnValue([]);
      mockContentProcessor.deduplicateArticles.mockReturnValue([]);
      mockContentProcessor.filterByDateRange.mockReturnValue([]);
      mockContentProcessor.processArticles.mockReturnValue([]);

      mockPipeline.processArticles.mockResolvedValue({
        success: true,
        data: {
          processedCount: 0,
          createdDevelopments: [],
          skippedCount: 0,
          errors: [],
          processingTime: 500
        }
      });

      const result = await processingService.processBatchAreas(batchJobs);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].jobId).toBe('job-1');
      expect(result.data?.[1].jobId).toBe('job-2');
    });

    it('should handle partial failures in batch processing', async () => {
      const batchJobs: ProcessingJobData[] = [
        {
          jobId: 'job-1',
          areaId: 'area-1',
          areaName: 'Tampines',
          articles: [
            {
              title: 'Article 1',
              content: 'Content 1',
              url: 'https://example.com/1',
              source: 'Source 1',
              publishDate: new Date()
            }
          ]
        },
        {
          jobId: 'job-2',
          areaId: 'area-2',
          areaName: 'Jurong',
          articles: [
            {
              title: 'Article 2',
              content: 'Content 2',
              url: 'https://example.com/2',
              source: 'Source 2',
              publishDate: new Date()
            }
          ]
        }
      ];

      // Mock first job success, second job failure
      mockContentProcessor.filterDevelopmentContent
        .mockReturnValueOnce([])
        .mockImplementationOnce(() => {
          throw new Error('Processing error');
        });
      
      mockContentProcessor.deduplicateArticles.mockReturnValue([]);
      mockContentProcessor.filterByDateRange.mockReturnValue([]);
      mockContentProcessor.processArticles.mockReturnValue([]);

      mockPipeline.processArticles.mockResolvedValue({
        success: true,
        data: {
          processedCount: 0,
          createdDevelopments: [],
          skippedCount: 0,
          errors: [],
          processingTime: 500
        }
      });

      const result = await processingService.processBatchAreas(batchJobs);

      expect(result.success).toBe(false);
      expect(result.data).toHaveLength(1); // Only successful job
      expect(result.error).toContain('Failed to process Jurong');
    });

    it('should handle empty batch', async () => {
      const result = await processingService.processBatchAreas([]);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('getProcessingStatistics', () => {
    it('should delegate to pipeline statistics', async () => {
      const mockStats = {
        totalDevelopments: 10,
        byType: { school: 3, infrastructure: 2, shopping: 3, business: 2 },
        avgImpactScore: 7.5,
        recentProcessingCount: 5
      };

      mockPipeline.getProcessingStatistics.mockResolvedValue(mockStats);

      const result = await processingService.getProcessingStatistics('area-1');

      expect(result).toEqual(mockStats);
      expect(mockPipeline.getProcessingStatistics).toHaveBeenCalledWith('area-1');
    });

    it('should handle statistics without area filter', async () => {
      const mockStats = {
        totalDevelopments: 25,
        byType: { school: 8, infrastructure: 6, shopping: 7, business: 4 },
        avgImpactScore: 6.8,
        recentProcessingCount: 12
      };

      mockPipeline.getProcessingStatistics.mockResolvedValue(mockStats);

      const result = await processingService.getProcessingStatistics();

      expect(result).toEqual(mockStats);
      expect(mockPipeline.getProcessingStatistics).toHaveBeenCalledWith(undefined);
    });
  });

  describe('reprocessArticles', () => {
    it('should return placeholder response for reprocessing', async () => {
      const result = await processingService.reprocessArticles('area-1');

      expect(result.success).toBe(true);
      expect(result.data?.processedCount).toBe(0);
      expect(result.data?.errors).toContain('Reprocessing not yet implemented - requires article storage system');
    });

    it('should handle reprocessing with date filter', async () => {
      const fromDate = new Date('2024-01-01');
      const result = await processingService.reprocessArticles('area-1', fromDate);

      expect(result.success).toBe(true);
      expect(result.data?.processedCount).toBe(0);
    });

    it('should handle reprocessing errors', async () => {
      // Mock console.log to throw error for testing error handling
      const originalConsoleLog = console.log;
      console.log = jest.fn().mockImplementation(() => {
        throw new Error('Logging error');
      });

      const result = await processingService.reprocessArticles('area-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Reprocessing failed');

      // Restore console.log
      console.log = originalConsoleLog;
    });
  });

  describe('cleanupDevelopments', () => {
    it('should return placeholder response for cleanup', async () => {
      const result = await processingService.cleanupDevelopments('area-1');

      expect(result.success).toBe(true);
      expect(result.data?.deletedCount).toBe(0);
    });

    it('should handle cleanup with custom age threshold', async () => {
      const result = await processingService.cleanupDevelopments('area-1', 180);

      expect(result.success).toBe(true);
      expect(result.data?.deletedCount).toBe(0);
    });

    it('should handle cleanup errors', async () => {
      // Mock console.log to throw error for testing error handling
      const originalConsoleLog = console.log;
      console.log = jest.fn().mockImplementation(() => {
        throw new Error('Logging error');
      });

      const result = await processingService.cleanupDevelopments('area-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cleanup failed');

      // Restore console.log
      console.log = originalConsoleLog;
    });
  });
});