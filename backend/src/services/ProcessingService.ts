import { DataProcessingPipeline, ProcessingResult } from './DataProcessingPipeline';
import { ContentProcessor } from './ContentProcessor';
import { IDevelopmentRepository } from '../repositories/DevelopmentRepository';
import { IAreaRepository } from '../repositories/AreaRepository';
import { ArticleData, ProcessedArticle, ServiceResponse } from '../types';

export interface ProcessingJobData {
  articles: ArticleData[];
  areaId: string;
  areaName: string;
  jobId: string;
}

export interface ProcessingServiceResult {
  jobId: string;
  areaId: string;
  areaName: string;
  processingResult: ProcessingResult;
  processedArticles: ProcessedArticle[];
}

export class ProcessingService {
  private contentProcessor: ContentProcessor;
  private dataProcessingPipeline: DataProcessingPipeline;

  constructor(
    developmentRepository: IDevelopmentRepository,
    areaRepository: IAreaRepository
  ) {
    this.contentProcessor = new ContentProcessor();
    this.dataProcessingPipeline = new DataProcessingPipeline(
      developmentRepository,
      areaRepository
    );
  }

  /**
   * Process crawler output and create development records
   */
  public async processArticlesForArea(
    jobData: ProcessingJobData
  ): Promise<ServiceResponse<ProcessingServiceResult>> {
    try {
      console.log(`Starting processing for area ${jobData.areaName} (${jobData.areaId})`);
      console.log(`Processing ${jobData.articles.length} articles`);

      // Step 1: Clean and filter articles
      const filteredArticles = this.contentProcessor.filterDevelopmentContent(jobData.articles);
      console.log(`Filtered to ${filteredArticles.length} development-related articles`);

      // Step 2: Remove duplicates
      const deduplicatedArticles = this.contentProcessor.deduplicateArticles(filteredArticles);
      console.log(`Deduplicated to ${deduplicatedArticles.length} unique articles`);

      // Step 3: Filter by date range (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const recentArticles = this.contentProcessor.filterByDateRange(deduplicatedArticles, twelveMonthsAgo);
      console.log(`Filtered to ${recentArticles.length} recent articles (last 12 months)`);

      // Step 4: Process articles to extract structured information
      const processedArticles = this.contentProcessor.processArticles(recentArticles);
      console.log(`Processed ${processedArticles.length} articles with structured data`);

      // Step 5: Run through data processing pipeline
      const pipelineResult = await this.dataProcessingPipeline.processArticles(
        processedArticles,
        jobData.areaId
      );

      if (!pipelineResult.success || !pipelineResult.data) {
        return {
          success: false,
          error: `Pipeline processing failed: ${pipelineResult.error}`
        };
      }

      console.log(`Pipeline created ${pipelineResult.data.createdDevelopments.length} developments`);
      console.log(`Pipeline skipped ${pipelineResult.data.skippedCount} articles`);
      console.log(`Pipeline errors: ${pipelineResult.data.errors.length}`);

      const result: ProcessingServiceResult = {
        jobId: jobData.jobId,
        areaId: jobData.areaId,
        areaName: jobData.areaName,
        processingResult: pipelineResult.data,
        processedArticles
      };

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('Error in processing service:', error);
      return {
        success: false,
        error: `Processing service failed: ${error}`
      };
    }
  }

  /**
   * Process articles for multiple areas in batch
   */
  public async processBatchAreas(
    batchJobs: ProcessingJobData[]
  ): Promise<ServiceResponse<ProcessingServiceResult[]>> {
    const results: ProcessingServiceResult[] = [];
    const errors: string[] = [];

    for (const jobData of batchJobs) {
      try {
        const result = await this.processArticlesForArea(jobData);
        if (result.success && result.data) {
          results.push(result.data);
        } else {
          errors.push(`Failed to process ${jobData.areaName}: ${result.error}`);
        }
      } catch (error) {
        errors.push(`Error processing ${jobData.areaName}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      data: results,
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  }

  /**
   * Validate processing job data
   */
  public validateProcessingJobData(jobData: ProcessingJobData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!jobData.jobId || jobData.jobId.trim().length === 0) {
      errors.push('Job ID is required');
    }

    if (!jobData.areaId || jobData.areaId.trim().length === 0) {
      errors.push('Area ID is required');
    }

    if (!jobData.areaName || jobData.areaName.trim().length === 0) {
      errors.push('Area name is required');
    }

    if (!Array.isArray(jobData.articles)) {
      errors.push('Articles must be an array');
    } else if (jobData.articles.length === 0) {
      errors.push('At least one article is required');
    } else {
      // Validate article structure
      for (let i = 0; i < Math.min(jobData.articles.length, 5); i++) {
        const article = jobData.articles[i];
        if (!article.title || !article.content || !article.url || !article.source) {
          errors.push(`Article ${i + 1} is missing required fields (title, content, url, source)`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get processing statistics for monitoring
   */
  public async getProcessingStatistics(areaId?: string) {
    return await this.dataProcessingPipeline.getProcessingStatistics(areaId);
  }

  /**
   * Reprocess existing articles with updated algorithms
   */
  public async reprocessArticles(
    areaId: string,
    fromDate?: Date
  ): Promise<ServiceResponse<ProcessingResult>> {
    try {
      // This would typically fetch articles from a storage system
      // For now, we'll return a placeholder response
      console.log(`Reprocessing articles for area ${areaId} from ${fromDate || 'beginning'}`);
      
      return {
        success: true,
        data: {
          processedCount: 0,
          createdDevelopments: [],
          skippedCount: 0,
          errors: ['Reprocessing not yet implemented - requires article storage system'],
          processingTime: 0
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Reprocessing failed: ${error}`
      };
    }
  }

  /**
   * Clean up old or invalid development records
   */
  public async cleanupDevelopments(
    areaId: string,
    olderThanDays: number = 365
  ): Promise<ServiceResponse<{ deletedCount: number }>> {
    try {
      // This would implement cleanup logic
      console.log(`Cleaning up developments for area ${areaId} older than ${olderThanDays} days`);
      
      return {
        success: true,
        data: { deletedCount: 0 }
      };

    } catch (error) {
      return {
        success: false,
        error: `Cleanup failed: ${error}`
      };
    }
  }
}