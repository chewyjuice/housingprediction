import { Request, Response } from 'express';
import { CrawlerService } from '../services/CrawlerService';
import { DevelopmentRepository } from '../repositories/DevelopmentRepository';

export class CrawlerController {
  private crawlerService: CrawlerService;

  constructor(developmentRepository: DevelopmentRepository) {
    this.crawlerService = new CrawlerService(developmentRepository);
  }

  /**
   * Start crawling for a specific area
   */
  public startCrawling = async (req: Request, res: Response): Promise<void> => {
    try {
      const { areaId, areaName, query } = req.body;

      if (!areaId || !areaName) {
        res.status(400).json({
          error: 'Area ID and name are required'
        });
        return;
      }

      const jobId = await this.crawlerService.addCrawlerJob(areaName, areaId, query);

      res.status(202).json({
        message: 'Crawling job started',
        jobId,
        status: 'queued'
      });
    } catch (error) {
      console.error('Error starting crawler job:', error);
      res.status(500).json({
        error: 'Failed to start crawling job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get crawling job status
   */
  public getJobStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({
          error: 'Job ID is required'
        });
        return;
      }

      const status = await this.crawlerService.getJobStatus(jobId);

      if (status === null) {
        res.status(404).json({
          error: 'Job not found'
        });
        return;
      }

      res.json({
        jobId,
        status
      });
    } catch (error) {
      console.error('Error getting job status:', error);
      res.status(500).json({
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get crawling job result
   */
  public getJobResult = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({
          error: 'Job ID is required'
        });
        return;
      }

      const result = await this.crawlerService.getJobResult(jobId);

      if (result === null) {
        res.status(404).json({
          error: 'Job not found or not completed'
        });
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error getting job result:', error);
      res.status(500).json({
        error: 'Failed to get job result',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}