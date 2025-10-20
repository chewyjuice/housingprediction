import { Request, Response } from 'express';
import { ProcessingService, ProcessingJobData } from '../services/ProcessingService';
import { DevelopmentRepository } from '../repositories/DevelopmentRepository';
import { AreaRepository } from '../repositories/AreaRepository';
import { DatabaseConnection } from '../database/connection';
import { ApiResponse } from '../types';

export class ProcessingController {
  private processingService: ProcessingService;

  constructor(db: DatabaseConnection) {
    const developmentRepository = new DevelopmentRepository(db);
    const areaRepository = new AreaRepository(db);
    this.processingService = new ProcessingService(developmentRepository, areaRepository);
  }

  /**
   * Process articles for a specific area
   */
  public processArticles = async (req: Request, res: Response): Promise<void> => {
    try {
      const jobData: ProcessingJobData = req.body;

      // Validate input
      const validation = this.processingService.validateProcessingJobData(jobData);
      if (!validation.isValid) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
        res.status(400).json(response);
        return;
      }

      // Process articles
      const result = await this.processingService.processArticlesForArea(jobData);

      if (result.success) {
        const response: ApiResponse<typeof result.data> = {
          success: true,
          data: result.data,
          message: `Successfully processed ${result.data?.processingResult.processedCount || 0} articles`
        };
        res.status(200).json(response);
      } else {
        const response: ApiResponse<null> = {
          success: false,
          error: result.error
        };
        res.status(500).json(response);
      }

    } catch (error) {
      console.error('Error in processArticles controller:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error during article processing'
      };
      res.status(500).json(response);
    }
  };

  /**
   * Process articles for multiple areas in batch
   */
  public processBatch = async (req: Request, res: Response): Promise<void> => {
    try {
      const batchJobs: ProcessingJobData[] = req.body.jobs;

      if (!Array.isArray(batchJobs) || batchJobs.length === 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Jobs array is required and must not be empty'
        };
        res.status(400).json(response);
        return;
      }

      // Validate each job
      for (let i = 0; i < batchJobs.length; i++) {
        const validation = this.processingService.validateProcessingJobData(batchJobs[i]);
        if (!validation.isValid) {
          const response: ApiResponse<null> = {
            success: false,
            error: `Job ${i + 1} validation failed: ${validation.errors.join(', ')}`
          };
          res.status(400).json(response);
          return;
        }
      }

      // Process batch
      const result = await this.processingService.processBatchAreas(batchJobs);

      if (result.success) {
        const totalProcessed = result.data?.reduce(
          (sum, job) => sum + job.processingResult.processedCount, 0
        ) || 0;

        const response: ApiResponse<typeof result.data> = {
          success: true,
          data: result.data,
          message: `Successfully processed ${totalProcessed} articles across ${batchJobs.length} areas`
        };
        res.status(200).json(response);
      } else {
        const response: ApiResponse<null> = {
          success: false,
          error: result.error
        };
        res.status(500).json(response);
      }

    } catch (error) {
      console.error('Error in processBatch controller:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error during batch processing'
      };
      res.status(500).json(response);
    }
  };

  /**
   * Get processing statistics
   */
  public getStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { areaId } = req.query;

      const stats = await this.processingService.getProcessingStatistics(
        areaId as string | undefined
      );

      const response: ApiResponse<typeof stats> = {
        success: true,
        data: stats
      };
      res.status(200).json(response);

    } catch (error) {
      console.error('Error in getStatistics controller:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error while fetching statistics'
      };
      res.status(500).json(response);
    }
  };

  /**
   * Reprocess articles for an area
   */
  public reprocessArticles = async (req: Request, res: Response): Promise<void> => {
    try {
      const { areaId } = req.params;
      const { fromDate } = req.body;

      if (!areaId) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Area ID is required'
        };
        res.status(400).json(response);
        return;
      }

      const parsedFromDate = fromDate ? new Date(fromDate) : undefined;
      if (fromDate && isNaN(parsedFromDate?.getTime() || 0)) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid fromDate format'
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.processingService.reprocessArticles(areaId, parsedFromDate);

      if (result.success) {
        const response: ApiResponse<typeof result.data> = {
          success: true,
          data: result.data,
          message: 'Reprocessing completed'
        };
        res.status(200).json(response);
      } else {
        const response: ApiResponse<null> = {
          success: false,
          error: result.error
        };
        res.status(500).json(response);
      }

    } catch (error) {
      console.error('Error in reprocessArticles controller:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error during reprocessing'
      };
      res.status(500).json(response);
    }
  };

  /**
   * Clean up old development records
   */
  public cleanupDevelopments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { areaId } = req.params;
      const { olderThanDays = 365 } = req.body;

      if (!areaId) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Area ID is required'
        };
        res.status(400).json(response);
        return;
      }

      if (typeof olderThanDays !== 'number' || olderThanDays < 1) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'olderThanDays must be a positive number'
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.processingService.cleanupDevelopments(areaId, olderThanDays);

      if (result.success) {
        const response: ApiResponse<typeof result.data> = {
          success: true,
          data: result.data,
          message: `Cleanup completed, deleted ${result.data?.deletedCount || 0} records`
        };
        res.status(200).json(response);
      } else {
        const response: ApiResponse<null> = {
          success: false,
          error: result.error
        };
        res.status(500).json(response);
      }

    } catch (error) {
      console.error('Error in cleanupDevelopments controller:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error during cleanup'
      };
      res.status(500).json(response);
    }
  };
}