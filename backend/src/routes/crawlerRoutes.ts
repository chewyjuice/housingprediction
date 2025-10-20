import { Router } from 'express';
import { CrawlerController } from '../controllers/CrawlerController';
import { DevelopmentRepository } from '../repositories/DevelopmentRepository';
import { DatabaseConnection } from '../database/connection';
import { databaseConfig } from '../config';

const router = Router();

// Initialize database connection, repository and controller
const db = DatabaseConnection.getInstance(databaseConfig);
const developmentRepository = new DevelopmentRepository(db);
const crawlerController = new CrawlerController(developmentRepository);

/**
 * @route POST /api/crawler/start
 * @desc Start crawling for development data in a specific area
 * @body { areaId: string, areaName: string, query?: string }
 */
router.post('/start', crawlerController.startCrawling);

/**
 * @route GET /api/crawler/status/:jobId
 * @desc Get the status of a crawling job
 * @param jobId - The ID of the crawling job
 */
router.get('/status/:jobId', crawlerController.getJobStatus);

/**
 * @route GET /api/crawler/result/:jobId
 * @desc Get the result of a completed crawling job
 * @param jobId - The ID of the crawling job
 */
router.get('/result/:jobId', crawlerController.getJobResult);

export default router;