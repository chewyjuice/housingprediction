import { CrawlerService, CrawlerJobData, CrawlerResult } from '../CrawlerService';
import { ContentProcessor } from '../ContentProcessor';
import { DevelopmentRepository } from '../../repositories/DevelopmentRepository';
import { StraitsTimesCrawler, ChannelNewsAsiaCrawler, PropertyGuruCrawler } from '../crawlers';
import Bull = require('bull');

// Mock dependencies
jest.mock('../ContentProcessor');
jest.mock('../../repositories/DevelopmentRepository');
jest.mock('../crawlers/StraitsTimes');
jest.mock('../crawlers/ChannelNewsAsia');
jest.mock('../crawlers/PropertyGuru');
jest.mock('bull');
jest.mock('node-cron');

describe('CrawlerService', () => {
  let crawlerService: CrawlerService;
  let mockDevelopmentRepository: jest.Mocked<DevelopmentRepository>;
  let mockContentProcessor: jest.Mocked<ContentProcessor>;
  let mockQueue: jest.Mocked<Bull.Queue>;
  let mockJob: jest.Mocked<Bull.Job>;

  const mockArticles = [
    {
      title: 'New School Development in Orchard',
      content: 'A new primary school will be built in Orchard area to serve the growing population.',
      url: 'https://example.com/article1',
      publishDate: new Date('2024-01-15'),
      source: 'The Straits Times'
    },
    {
      title: 'MRT Station Upgrade in Tampines',
      content: 'The Tampines MRT station will undergo major upgrades to improve connectivity.',
      url: 'https://example.com/article2',
      publishDate: new Date('2024-02-10'),
      source: 'Channel NewsAsia'
    }
  ];

  const mockProcessedArticles = [
    {
      ...mockArticles[0],
      keywords: ['school', 'education', 'development'],
      developmentType: 'school' as const,
      relevanceScore: 8,
      extractedEntities: {
        locations: ['orchard'],
        organizations: ['MOE'],
        projects: ['Primary School']
      }
    },
    {
      ...mockArticles[1],
      keywords: ['mrt', 'transport', 'infrastructure'],
      developmentType: 'infrastructure' as const,
      relevanceScore: 7,
      extractedEntities: {
        locations: ['tampines'],
        organizations: ['LTA'],
        projects: ['MRT Station Upgrade']
      }
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock repository
    mockDevelopmentRepository = {
      create: jest.fn().mockResolvedValue({ id: '1' }),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByAreaId: jest.fn()
    } as any;

    // Mock content processor
    mockContentProcessor = {
      filterDevelopmentContent: jest.fn().mockReturnValue(mockArticles),
      deduplicateArticles: jest.fn().mockReturnValue(mockArticles),
      filterByDateRange: jest.fn().mockReturnValue(mockArticles),
      processArticles: jest.fn().mockReturnValue(mockProcessedArticles),
      cleanText: jest.fn().mockImplementation((text: string) => text.trim())
    } as any;

    // Mock Bull queue
    mockJob = {
      id: 'test-job-1',
      data: {
        areaName: 'Orchard',
        areaId: 'area-1',
        query: 'Orchard',
        fromDate: new Date('2023-01-01'),
        jobId: 'crawler-area-1-123456'
      },
      progress: jest.fn().mockResolvedValue(undefined),
      finishedOn: undefined,
      processedOn: undefined,
      failedReason: undefined,
      returnvalue: null
    } as any;

    mockQueue = {
      add: jest.fn().mockResolvedValue(mockJob),
      getJob: jest.fn().mockResolvedValue(mockJob),
      process: jest.fn(),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined)
    } as any;

    (Bull as any).mockImplementation(() => mockQueue);

    // Mock crawlers
    (StraitsTimesCrawler as jest.MockedClass<typeof StraitsTimesCrawler>).mockImplementation(() => ({
      searchArticles: jest.fn().mockResolvedValue([mockArticles[0]])
    } as any));

    (ChannelNewsAsiaCrawler as jest.MockedClass<typeof ChannelNewsAsiaCrawler>).mockImplementation(() => ({
      searchArticles: jest.fn().mockResolvedValue([mockArticles[1]])
    } as any));

    (PropertyGuruCrawler as jest.MockedClass<typeof PropertyGuruCrawler>).mockImplementation(() => ({
      searchArticles: jest.fn().mockResolvedValue([])
    } as any));

    (ContentProcessor as jest.MockedClass<typeof ContentProcessor>).mockImplementation(() => mockContentProcessor);

    crawlerService = new CrawlerService(mockDevelopmentRepository);
  });

  describe('addCrawlerJob', () => {
    it('should add a crawler job to the queue successfully', async () => {
      const areaName = 'Orchard';
      const areaId = 'area-1';
      const query = 'Orchard development';

      const jobId = await crawlerService.addCrawlerJob(areaName, areaId, query);

      expect(jobId).toMatch(/^crawler-area-1-\d+$/);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'crawl-area',
        expect.objectContaining({
          areaName,
          areaId,
          query,
          jobId: expect.stringMatching(/^crawler-area-1-\d+$/),
          fromDate: expect.any(Date)
        }),
        expect.objectContaining({
          jobId: expect.stringMatching(/^crawler-area-1-\d+$/),
          delay: 0,
          timeout: 60000
        })
      );
    });

    it('should use area name as default query when no query provided', async () => {
      const areaName = 'Tampines';
      const areaId = 'area-2';

      await crawlerService.addCrawlerJob(areaName, areaId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'crawl-area',
        expect.objectContaining({
          query: areaName
        }),
        expect.any(Object)
      );
    });

    it('should set fromDate to 12 months ago', async () => {
      const areaName = 'Orchard';
      const areaId = 'area-1';
      const beforeCall = new Date();
      beforeCall.setFullYear(beforeCall.getFullYear() - 1);

      await crawlerService.addCrawlerJob(areaName, areaId);

      const callArgs = (mockQueue.add as jest.Mock).mock.calls[0][1];
      const fromDate = callArgs.fromDate;
      
      expect(fromDate).toBeInstanceOf(Date);
      expect(fromDate.getFullYear()).toBe(beforeCall.getFullYear());
    });
  });

  describe('getJobResult', () => {
    it('should return job result when job is completed', async () => {
      const expectedResult: CrawlerResult = {
        jobId: 'test-job-1',
        areaId: 'area-1',
        areaName: 'Orchard',
        articles: mockProcessedArticles,
        totalArticles: 2,
        processingTime: 5000,
        errors: []
      };

      mockJob.finishedOn = Date.now();
      mockJob.returnvalue = expectedResult;

      const result = await crawlerService.getJobResult('test-job-1');

      expect(mockQueue.getJob).toHaveBeenCalledWith('test-job-1');
      expect(result).toEqual(expectedResult);
    });

    it('should return null when job is not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await crawlerService.getJobResult('nonexistent-job');

      expect(result).toBeNull();
    });

    it('should return null when job is not finished', async () => {
      mockJob.finishedOn = undefined;

      const result = await crawlerService.getJobResult('test-job-1');

      expect(result).toBeNull();
    });
  });

  describe('getJobStatus', () => {
    it('should return "completed" for finished successful job', async () => {
      mockJob.finishedOn = Date.now();
      mockJob.failedReason = undefined;

      const status = await crawlerService.getJobStatus('test-job-1');

      expect(status).toBe('completed');
    });

    it('should return "failed" for finished failed job', async () => {
      mockJob.finishedOn = Date.now();
      mockJob.failedReason = 'Network timeout';

      const status = await crawlerService.getJobStatus('test-job-1');

      expect(status).toBe('failed');
    });

    it('should return "processing" for job that is being processed', async () => {
      mockJob.finishedOn = undefined;
      mockJob.processedOn = Date.now();

      const status = await crawlerService.getJobStatus('test-job-1');

      expect(status).toBe('processing');
    });

    it('should return "waiting" for job that is queued', async () => {
      mockJob.finishedOn = undefined;
      mockJob.processedOn = undefined;

      const status = await crawlerService.getJobStatus('test-job-1');

      expect(status).toBe('waiting');
    });

    it('should return null when job is not found', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const status = await crawlerService.getJobStatus('nonexistent-job');

      expect(status).toBeNull();
    });
  });

  describe('job processing', () => {
    let jobProcessor: (job: Bull.Job<CrawlerJobData>) => Promise<CrawlerResult>;

    beforeEach(() => {
      // Capture the job processor function from the service setup
      // We need to access the private method directly for testing
      jobProcessor = (crawlerService as any).setupJobProcessor.bind(crawlerService);
      
      // Mock the actual job processor by calling the queue process method
      const processCall = (mockQueue.process as jest.Mock).mock.calls.find(
        call => call[0] === 'crawl-area'
      );
      if (processCall) {
        jobProcessor = processCall[2]; // Third argument is the processor function
      }
    });

    it('should process job successfully with all crawlers', async () => {
      const jobData: CrawlerJobData = {
        areaName: 'Orchard',
        areaId: 'area-1',
        query: 'Orchard',
        fromDate: new Date('2023-01-01'),
        jobId: 'test-job-1'
      };

      mockJob.data = jobData;

      const result = await jobProcessor(mockJob);

      expect(result).toEqual(expect.objectContaining({
        jobId: 'test-job-1',
        areaId: 'area-1',
        areaName: 'Orchard',
        articles: mockProcessedArticles,
        totalArticles: 2,
        errors: []
      }));

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(30);
      expect(mockJob.progress).toHaveBeenCalledWith(60);
      expect(mockJob.progress).toHaveBeenCalledWith(80);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should handle crawler timeouts gracefully', async () => {
      // Create a new crawler service with a mocked crawler that times out
      const timeoutError = new Error('Straits Times crawler timeout');
      
      // Mock the crawlWithTimeout method to simulate timeout
      const crawlWithTimeoutSpy = jest.spyOn(crawlerService as any, 'crawlWithTimeout');
      crawlWithTimeoutSpy
        .mockResolvedValueOnce({ articles: [], error: 'Straits Times: Straits Times crawler timeout' })
        .mockResolvedValueOnce({ articles: [mockArticles[1]] })
        .mockResolvedValueOnce({ articles: [] });

      const jobData: CrawlerJobData = {
        areaName: 'Orchard',
        areaId: 'area-1',
        query: 'Orchard',
        fromDate: new Date('2023-01-01'),
        jobId: 'test-job-1'
      };

      mockJob.data = jobData;

      const result = await jobProcessor(mockJob);

      expect(result.errors).toContain('Straits Times: Straits Times crawler timeout');
      expect(result.articles.length).toBeGreaterThanOrEqual(0);
      
      crawlWithTimeoutSpy.mockRestore();
    });

    it('should handle processing errors and return error result', async () => {
      // Mock a critical error that would cause the entire job to fail
      const processingError = new Error('Critical processing failure');
      mockContentProcessor.processArticles.mockImplementation(() => {
        throw processingError;
      });

      const jobData: CrawlerJobData = {
        areaName: 'Orchard',
        areaId: 'area-1',
        query: 'Orchard',
        fromDate: new Date('2023-01-01'),
        jobId: 'test-job-1'
      };

      mockJob.data = jobData;

      const result = await jobProcessor(mockJob);

      expect(result.errors).toContain('Processing error: Critical processing failure');
      expect(result.totalArticles).toBe(0);
      expect(result.articles).toEqual([]);
    });

    it('should store developments in database', async () => {
      const jobData: CrawlerJobData = {
        areaName: 'Orchard',
        areaId: 'area-1',
        query: 'Orchard',
        fromDate: new Date('2023-01-01'),
        jobId: 'test-job-1'
      };

      mockJob.data = jobData;

      await jobProcessor(mockJob);

      expect(mockDevelopmentRepository.create).toHaveBeenCalledTimes(2);
      expect(mockDevelopmentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          areaId: 'area-1',
          type: 'school',
          title: 'New School Development in Orchard',
          impactScore: expect.any(Number),
          sourceUrl: 'https://example.com/article1'
        })
      );
    });
  });

  describe('shutdown', () => {
    it('should close the queue gracefully', async () => {
      await crawlerService.shutdown();

      expect(mockQueue.close).toHaveBeenCalled();
    });
  });
});