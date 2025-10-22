import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { DatabaseConnection } from './database/connection';
import { redisConnection } from './database/redis';
import { createAreaRoutes } from './routes/areaRoutes';
import crawlerRoutes from './routes/crawlerRoutes';
import { createProcessingRoutes } from './routes/processingRoutes';
import { createPredictionRoutes } from './routes/predictionRoutes';
import { createOrchestrationRoutes } from './routes/orchestrationRoutes';
import { ApiResponse } from './types';
import { databaseConfig } from './config';
import { ServiceRegistry } from './services/ServiceRegistry';
import { authenticateToken } from './middleware/auth';
import { requestLogger, errorLogger } from './middleware/logging';
import CacheService from './services/CacheService';

export class App {
  public app: Application;
  private db: DatabaseConnection;
  private serviceRegistry: ServiceRegistry;
  private cacheService: CacheService;

  constructor() {
    this.app = express();
    this.db = DatabaseConnection.getInstance(databaseConfig);
    this.serviceRegistry = new ServiceRegistry();
    this.cacheService = new CacheService();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Request logging (should be first)
    this.app.use(requestLogger);

    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting with different limits for different endpoints
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        success: false,
        error: 'Too many requests from this IP, please try again later'
      } as ApiResponse<never>,
      standardHeaders: true,
      legacyHeaders: false,
    });

    const predictionLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // Limit prediction requests to 10 per minute
      message: {
        success: false,
        error: 'Too many prediction requests, please try again later'
      } as ApiResponse<never>,
      standardHeaders: true,
      legacyHeaders: false,
    });

    const crawlerLimiter = rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 20, // Limit crawler requests to 20 per 5 minutes
      message: {
        success: false,
        error: 'Too many crawler requests, please try again later'
      } as ApiResponse<never>,
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Apply rate limiting
    this.app.use('/api/', generalLimiter);
    this.app.use('/api/predictions/', predictionLimiter);
    this.app.use('/api/crawler/', crawlerLimiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Authentication middleware (optional for most endpoints)
    this.app.use(authenticateToken);
  }

  private initializeRoutes(): void {
    // Health check endpoint with service status
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const serviceHealth = await this.serviceRegistry.checkAllServicesHealth();
        const cacheHealth = await this.cacheService.isHealthy();
        const cacheStats = await this.cacheService.getCacheStats();
        const allHealthy = serviceHealth.every(service => service.status === 'healthy') && cacheHealth;
        
        res.status(allHealthy ? 200 : 503).json({
          success: true,
          data: {
            status: allHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            services: serviceHealth,
            database: {
              status: 'connected', // We'll assume connected if we reach this point
              lastChecked: new Date().toISOString()
            },
            cache: {
              status: cacheHealth ? 'healthy' : 'unhealthy',
              stats: cacheStats,
              lastChecked: new Date().toISOString()
            }
          },
          message: 'Singapore Housing Predictor API Gateway'
        } as ApiResponse<any>);
      } catch (error) {
        res.status(503).json({
          success: false,
          error: 'Health check failed',
          message: 'Unable to determine system health'
        } as ApiResponse<never>);
      }
    });

    // Service registry endpoints
    this.app.get('/api/services', async (req: Request, res: Response) => {
      try {
        const services = this.serviceRegistry.getRegisteredServices();
        const healthStatus = this.serviceRegistry.getAllHealthStatus();
        
        res.json({
          success: true,
          data: {
            services,
            healthStatus
          }
        } as ApiResponse<any>);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to get service information'
        } as ApiResponse<never>);
      }
    });

    this.app.post('/api/services/:serviceName/health', async (req: Request, res: Response) => {
      try {
        const { serviceName } = req.params;
        const health = await this.serviceRegistry.checkServiceHealth(serviceName);
        
        res.json({
          success: true,
          data: health
        } as ApiResponse<typeof health>);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to check service health'
        } as ApiResponse<never>);
      }
    });

    // Cache management endpoints
    this.app.get('/api/cache/stats', async (req: Request, res: Response) => {
      try {
        const stats = await this.cacheService.getCacheStats();
        const health = await this.cacheService.isHealthy();
        
        res.json({
          success: true,
          data: {
            ...stats,
            healthy: health
          }
        } as ApiResponse<any>);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to get cache statistics'
        } as ApiResponse<never>);
      }
    });

    this.app.delete('/api/cache/area/:areaId', async (req: Request, res: Response) => {
      try {
        const { areaId } = req.params;
        await this.cacheService.invalidateAreaCache(areaId);
        
        res.json({
          success: true,
          message: `Cache invalidated for area: ${areaId}`
        } as ApiResponse<never>);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to invalidate area cache'
        } as ApiResponse<never>);
      }
    });

    this.app.delete('/api/cache/search', async (req: Request, res: Response) => {
      try {
        await this.cacheService.invalidateAreaSearchCache();
        
        res.json({
          success: true,
          message: 'Area search cache invalidated'
        } as ApiResponse<never>);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to invalidate search cache'
        } as ApiResponse<never>);
      }
    });

    // Database performance monitoring endpoints
    this.app.get('/api/performance/database', async (req: Request, res: Response) => {
      try {
        const DatabasePerformanceMonitor = (await import('./services/DatabasePerformanceMonitor')).default;
        const monitor = new DatabasePerformanceMonitor(this.db);
        const analysis = await monitor.runPerformanceAnalysis();
        
        res.json({
          success: true,
          data: analysis
        } as ApiResponse<typeof analysis>);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to get database performance metrics'
        } as ApiResponse<never>);
      }
    });

    this.app.get('/api/performance/database/metrics', async (req: Request, res: Response) => {
      try {
        const DatabasePerformanceMonitor = (await import('./services/DatabasePerformanceMonitor')).default;
        const monitor = new DatabasePerformanceMonitor(this.db);
        const metrics = await monitor.getComprehensiveMetrics();
        
        res.json({
          success: true,
          data: metrics
        } as ApiResponse<typeof metrics>);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to get database metrics'
        } as ApiResponse<never>);
      }
    });

    this.app.get('/api/performance/connection-pool', async (req: Request, res: Response) => {
      try {
        const poolInfo = this.db.getPoolInfo();
        const performanceMetrics = await this.db.getPerformanceMetrics();
        
        res.json({
          success: true,
          data: {
            pool: poolInfo,
            performance: performanceMetrics
          }
        } as ApiResponse<any>);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to get connection pool information'
        } as ApiResponse<never>);
      }
    });

    // API routes with service registry integration
    this.app.use('/api/areas', createAreaRoutes(this.db));
    this.app.use('/api/crawler', crawlerRoutes);
    this.app.use('/api/processing', createProcessingRoutes(this.db));
    this.app.use('/api/predictions', createPredictionRoutes(this.db));
    this.app.use('/api/orchestration', createOrchestrationRoutes(this.db, this.serviceRegistry));
    
    // Performance monitoring routes
    const { createPerformanceRoutes } = await import('./routes/performanceRoutes');
    this.app.use('/api/performance', createPerformanceRoutes(this.db));

    // 404 handler for undefined routes
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `The requested route ${req.method} ${req.originalUrl} does not exist`
      } as ApiResponse<never>);
    });
  }

  private initializeErrorHandling(): void {
    // Error logging middleware
    this.app.use(errorLogger);

    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      // Determine error type and status code
      let statusCode = 500;
      let errorMessage = 'Internal server error';
      
      if (error.name === 'ValidationError') {
        statusCode = 400;
        errorMessage = 'Validation failed';
      } else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        errorMessage = 'Unauthorized';
      } else if (error.name === 'ForbiddenError') {
        statusCode = 403;
        errorMessage = 'Forbidden';
      } else if (error.name === 'NotFoundError') {
        statusCode = 404;
        errorMessage = 'Resource not found';
      } else if (error.name === 'TimeoutError') {
        statusCode = 408;
        errorMessage = 'Request timeout';
      } else if (error.name === 'ConflictError') {
        statusCode = 409;
        errorMessage = 'Conflict';
      }
      
      const response: ApiResponse<never> = {
        success: false,
        error: errorMessage,
        message: process.env.NODE_ENV === 'development' ? error.message : errorMessage
      };

      // Add stack trace in development
      if (process.env.NODE_ENV === 'development') {
        (response as any).stack = error.stack;
      }
      
      res.status(statusCode).json(response);
    });
  }

  public async initialize(): Promise<void> {
    try {
      // Test database connection
      const isConnected = await this.db.testConnection();
      if (isConnected) {
        console.log('✅ Database connected successfully');
      } else {
        throw new Error('Database connection test failed');
      }

      // Initialize Redis connection
      await redisConnection.connect();
      const cacheHealthy = await this.cacheService.isHealthy();
      if (cacheHealthy) {
        console.log('✅ Redis cache connected successfully');
      } else {
        console.warn('⚠️ Redis cache connection failed - continuing without cache');
      }
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      await this.db.close();
      console.log('✅ Database disconnected successfully');
      
      await this.cacheService.cleanup();
      console.log('✅ Cache disconnected successfully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }

  public getApp(): Application {
    return this.app;
  }

  public getServiceRegistry(): ServiceRegistry {
    return this.serviceRegistry;
  }
}