import Bull = require('bull');
import { Queue, Job } from 'bull';
import * as cron from 'node-cron';
import { StraitsTimesCrawler, ChannelNewsAsiaCrawler, PropertyGuruCrawler, ArticleData } from './crawlers';
import { ContentProcessor } from './ContentProcessor';
import { ProcessedArticle } from '../types';
import { DevelopmentRepository } from '../repositories/DevelopmentRepository';

export interface CrawlerJobData {
  areaName: string;
  areaId: string;
  query: string;
  fromDate: Date;
  jobId: string;
}

export interface CrawlerResult {
  jobId: string;
  areaId: string;
  areaName: string;
  articles: ProcessedArticle[];
  totalArticles: number;
  processingTime: number;
  errors: string[];
}

export class CrawlerService {
  private crawlerQueue: Queue<CrawlerJobData>;
  private contentProcessor: ContentProcessor;
  private developmentRepository: DevelopmentRepository;
  private crawlers: {
    straits: StraitsTimesCrawler;
    cna: ChannelNewsAsiaCrawler;
    propertyGuru: PropertyGuruCrawler;
  };

  constructor(developmentRepository: DevelopmentRepository) {
    this.developmentRepository = developmentRepository;
    this.contentProcessor = new ContentProcessor();
    
    // Initialize crawlers
    this.crawlers = {
      straits: new StraitsTimesCrawler(),
      cna: new ChannelNewsAsiaCrawler(),
      propertyGuru: new PropertyGuruCrawler()
    };

    // Initialize Bull queue with Redis connection
    this.crawlerQueue = new Bull('crawler jobs', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        removeOnComplete: 10, // Keep last 10 completed jobs
        removeOnFail: 5, // Keep last 5 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.setupJobProcessor();
    this.setupScheduledJobs();
  }

  /**
   * Add a crawling job to the queue
   */
  public async addCrawlerJob(areaName: string, areaId: string, query?: string): Promise<string> {
    const jobId = `crawler-${areaId}-${Date.now()}`;
    const fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - 1); // Last 12 months

    const jobData: CrawlerJobData = {
      areaName,
      areaId,
      query: query || areaName,
      fromDate,
      jobId
    };

    const job = await this.crawlerQueue.add('crawl-area', jobData, {
      jobId,
      delay: 0,
      timeout: 60000 // 60 second timeout
    });

    console.log(`Added crawler job ${jobId} for area: ${areaName}`);
    return jobId;
  }

  /**
   * Get job status and result
   */
  public async getJobResult(jobId: string): Promise<CrawlerResult | null> {
    const job = await this.crawlerQueue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    if (job.finishedOn) {
      return job.returnvalue as CrawlerResult;
    }

    return null;
  }

  /**
   * Get job status
   */
  public async getJobStatus(jobId: string): Promise<string | null> {
    const job = await this.crawlerQueue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    if (job.finishedOn) {
      return job.failedReason ? 'failed' : 'completed';
    }

    if (job.processedOn) {
      return 'processing';
    }

    return 'waiting';
  }

  /**
   * Setup job processor
   */
  private setupJobProcessor(): void {
    this.crawlerQueue.process('crawl-area', 3, async (job: Job<CrawlerJobData>) => {
      const startTime = Date.now();
      const { areaName, areaId, query, fromDate, jobId } = job.data;
      
      console.log(`Processing crawler job ${jobId} for area: ${areaName}`);
      
      const errors: string[] = [];
      let allArticles: ArticleData[] = [];

      try {
        // Update job progress
        await job.progress(10);

        // Crawl from all sources
        const crawlerPromises = [
          this.crawlWithTimeout(this.crawlers.straits, query, areaName, fromDate, 'Straits Times'),
          this.crawlWithTimeout(this.crawlers.cna, query, areaName, fromDate, 'Channel NewsAsia'),
          this.crawlWithTimeout(this.crawlers.propertyGuru, query, areaName, fromDate, 'PropertyGuru')
        ];

        await job.progress(30);

        const results = await Promise.allSettled(crawlerPromises);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            allArticles.push(...result.value.articles);
            if (result.value.error) {
              errors.push(result.value.error);
            }
          } else {
            const sources = ['Straits Times', 'Channel NewsAsia', 'PropertyGuru'];
            errors.push(`${sources[index]}: ${result.reason.message}`);
          }
        });

        await job.progress(60);

        // Process and filter articles
        const filteredArticles = this.contentProcessor.filterDevelopmentContent(allArticles);
        const deduplicatedArticles = this.contentProcessor.deduplicateArticles(filteredArticles);
        const recentArticles = this.contentProcessor.filterByDateRange(deduplicatedArticles, fromDate);
        const processedArticles = this.contentProcessor.processArticles(recentArticles);

        await job.progress(80);

        // Store developments in database
        await this.storeDevelopments(processedArticles, areaId);

        await job.progress(100);

        const processingTime = Date.now() - startTime;
        
        const result: CrawlerResult = {
          jobId,
          areaId,
          areaName,
          articles: processedArticles,
          totalArticles: processedArticles.length,
          processingTime,
          errors
        };

        console.log(`Completed crawler job ${jobId}: ${processedArticles.length} articles processed in ${processingTime}ms`);
        
        return result;

      } catch (error) {
        console.error(`Error in crawler job ${jobId}:`, error);
        errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        const processingTime = Date.now() - startTime;
        
        return {
          jobId,
          areaId,
          areaName,
          articles: [],
          totalArticles: 0,
          processingTime,
          errors
        } as CrawlerResult;
      }
    });

    // Setup error handling
    this.crawlerQueue.on('failed', (job, err) => {
      console.error(`Crawler job ${job.id} failed:`, err);
    });

    this.crawlerQueue.on('completed', (job, result) => {
      console.log(`Crawler job ${job.id} completed with ${result.totalArticles} articles`);
    });
  }

  /**
   * Crawl with timeout handling
   */
  private async crawlWithTimeout(
    crawler: StraitsTimesCrawler | ChannelNewsAsiaCrawler | PropertyGuruCrawler,
    query: string,
    areaName: string,
    fromDate: Date,
    sourceName: string
  ): Promise<{ articles: ArticleData[]; error?: string }> {
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${sourceName} crawler timeout`)), 20000); // 20 second timeout per crawler
    });

    try {
      const articles = await Promise.race([
        crawler.searchArticles(query, areaName, fromDate),
        timeoutPromise
      ]);

      return { articles };
    } catch (error) {
      console.warn(`${sourceName} crawler failed:`, error);
      return { 
        articles: [], 
        error: `${sourceName}: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Store processed articles as developments in database
   */
  private async storeDevelopments(articles: ProcessedArticle[], areaId: string): Promise<void> {
    for (const article of articles) {
      try {
        // Calculate impact score based on relevance and development type
        let impactScore = article.relevanceScore;
        
        // Adjust impact score based on development type
        switch (article.developmentType) {
          case 'infrastructure':
            impactScore *= 1.5;
            break;
          case 'school':
            impactScore *= 1.3;
            break;
          case 'shopping':
            impactScore *= 1.2;
            break;
          case 'business':
            impactScore *= 1.1;
            break;
          case 'mixed':
            impactScore *= 1.4;
            break;
        }

        const development = {
          areaId,
          type: article.developmentType === 'unknown' || article.developmentType === 'mixed' ? 'business' : article.developmentType,
          title: article.title,
          description: article.content.substring(0, 500), // Limit description length
          impactScore: Math.min(impactScore, 10), // Cap at 10
          dateAnnounced: article.publishDate,
          expectedCompletion: undefined, // Could be extracted from content in future
          sourceUrl: article.url,
          sourcePublisher: article.source,
          sourcePublishDate: article.publishDate
        };

        await this.developmentRepository.create(development);
      } catch (error) {
        console.warn(`Failed to store development from article ${article.url}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  /**
   * Setup scheduled jobs for periodic data updates
   */
  private setupScheduledJobs(): void {
    // Run daily at 2 AM to update development data
    cron.schedule('0 2 * * *', async () => {
      console.log('Running scheduled crawler update...');
      
      try {
        // Get all areas that need updates (could be based on last update time)
        // For now, we'll just log that the scheduler is running
        console.log('Scheduled crawler job triggered - implement area selection logic');
        
        // TODO: Implement logic to select areas that need updates
        // This could be based on:
        // - Areas with recent prediction requests
        // - Areas that haven't been updated in X days
        // - High-priority areas
        
      } catch (error) {
        console.error('Error in scheduled crawler job:', error instanceof Error ? error.message : error);
      }
    });

    console.log('Crawler scheduler initialized - daily updates at 2 AM');
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('Shutting down crawler service...');
    await this.crawlerQueue.close();
  }
}