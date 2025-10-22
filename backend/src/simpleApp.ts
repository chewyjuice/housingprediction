import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { SimpleAreaController } from './controllers/SimpleAreaController';
import { fileStorage } from './database/fileStorage';

export class SimpleApp {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
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

    // Rate limiting
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        success: false,
        error: 'Too many requests from this IP, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.app.use('/api/', generalLimiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        // Test file storage
        await fileStorage.readData('test');
        
        res.json({
          success: true,
          data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            database: {
              status: 'connected',
              type: 'file-storage',
              lastChecked: new Date().toISOString()
            }
          },
          message: 'Singapore Housing Predictor API - Simple Mode'
        });
      } catch (error) {
        res.status(503).json({
          success: false,
          error: 'Health check failed',
          message: 'Unable to determine system health'
        });
      }
    });

    // Area routes
    const areaController = new SimpleAreaController();
    const areaRouter = Router();
    
    areaRouter.get('/search', areaController.searchAreas);
    areaRouter.get('/districts', areaController.getDistricts);
    areaRouter.get('/nearby', areaController.getNearbyAreas);
    areaRouter.post('/validate', areaController.validateCoordinates);
    areaRouter.get('/:id', areaController.getAreaById);
    
    this.app.use('/api/areas', areaRouter);

    // Simple prediction endpoint (mock for now)
    this.app.post('/api/predictions/request', async (req: Request, res: Response) => {
      try {
        const { areaId, timeframeYears, propertyType, unitSize, roomType } = req.body;
        
        // Validate request
        if (!areaId || !timeframeYears || !propertyType) {
          res.status(400).json({
            success: false,
            error: 'Missing required fields: areaId, timeframeYears, propertyType'
          });
          return;
        }

        // Get area data using the same method as the area controller
        const areaController = new SimpleAreaController();
        const areas = await areaController.getOrInitializeAreas();
        const area = areas.find(a => a.id === areaId);
        if (!area) {
          console.log('Area not found for ID:', areaId, 'Available areas:', areas.map(a => a.id));
          res.status(404).json({
            success: false,
            error: 'Area not found'
          });
          return;
        }

        // Generate prediction request ID
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        
        // Store prediction request
        const predictionRequest = {
          id: requestId,
          areaId,
          timeframeYears,
          propertyType,
          unitSize: unitSize || 1000,
          roomType,
          status: 'processing',
          createdAt: new Date().toISOString()
        };
        
        await fileStorage.appendData('prediction_requests', predictionRequest);

        // Simulate processing and generate result
        setTimeout(async () => {
          try {
            console.log(`[PREDICTION] Generating prediction for requestId: ${requestId}`);
            const result = await this.generatePrediction(area, predictionRequest);
            console.log(`[PREDICTION] Generated result with id: ${result.id} for requestId: ${result.requestId}`);
            await fileStorage.appendData('prediction_results', result);
            console.log(`[PREDICTION] Stored result for requestId: ${result.requestId}`);
          } catch (error) {
            console.error('Error generating prediction:', error);
          }
        }, 2000); // 2 second delay to simulate processing

        res.status(201).json({
          success: true,
          data: {
            requestId,
            areaId,
            timeframeYears,
            status: 'processing',
            message: 'Prediction request created and processing started'
          }
        });

      } catch (error) {
        console.error('Error creating prediction request:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // Get prediction result
    this.app.get('/api/predictions/request/:requestId', async (req: Request, res: Response) => {
      try {
        const { requestId } = req.params;
        console.log(`[PREDICTION] Looking for result with requestId: ${requestId}`);
        
        const results = await fileStorage.readData('prediction_results');
        console.log(`[PREDICTION] Found ${results.length} total results in storage`);
        
        if (results.length > 0) {
          console.log(`[PREDICTION] Available requestIds: ${results.map((r: any) => r.requestId).join(', ')}`);
        }
        
        const result = results.find((r: any) => r.requestId === requestId);
        
        if (!result) {
          console.log(`[PREDICTION] Result not found for requestId: ${requestId}`);
          res.status(404).json({
            success: false,
            error: 'Prediction result not found'
          });
          return;
        }

        console.log(`[PREDICTION] Result found for requestId: ${requestId}`);
        res.json({
          success: true,
          data: result
        });

      } catch (error) {
        console.error('Error getting prediction result:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // 404 handler for undefined routes
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `The requested route ${req.method} ${req.originalUrl} does not exist`
      });
    });
  }

  private async generatePrediction(area: any, request: any) {
    // Simple prediction algorithm based on area characteristics
    const basePrices = {
      'HDB': 400,
      'Condo': 1200,
      'Landed': 1800
    };

    const basePricePerSqft = basePrices[request.propertyType as keyof typeof basePrices] || 1000;
    
    // Apply area-based multipliers
    let areaMultiplier = 1.0;
    if (area.district.toLowerCase().includes('central') || area.district.toLowerCase().includes('orchard')) {
      areaMultiplier = 1.5;
    } else if (area.district.toLowerCase().includes('marina') || area.district.toLowerCase().includes('raffles')) {
      areaMultiplier = 1.4;
    }

    // Apply time-based growth
    const annualGrowthRate = 0.03 + (Math.random() * 0.02); // 3-5% annual growth
    const timeMultiplier = Math.pow(1 + annualGrowthRate, request.timeframeYears);

    const predictedPricePerSqft = basePricePerSqft * areaMultiplier * timeMultiplier;
    const predictedPrice = predictedPricePerSqft * request.unitSize;

    // Generate confidence interval
    const confidenceRange = predictedPrice * 0.15; // ±15%

    return {
      id: `pred_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      requestId: request.id,
      predictedPrice,
      predictedPricePerSqft,
      propertyType: request.propertyType,
      unitSize: request.unitSize,
      roomType: request.roomType,
      confidenceInterval: {
        lower: predictedPrice - confidenceRange,
        upper: predictedPrice + confidenceRange,
        lowerPerSqft: predictedPricePerSqft - (confidenceRange / request.unitSize),
        upperPerSqft: predictedPricePerSqft + (confidenceRange / request.unitSize)
      },
      influencingFactors: [
        {
          developmentId: 'dev_transport',
          impactWeight: 0.25,
          description: `Transportation improvements in ${area.name} area`
        },
        {
          developmentId: 'dev_commercial',
          impactWeight: 0.20,
          description: `Commercial development projects nearby`
        },
        {
          developmentId: 'dev_residential',
          impactWeight: 0.15,
          description: `New residential developments in the district`
        }
      ],
      modelAccuracy: 0.75 + Math.random() * 0.20, // 75-95% accuracy
      generatedAt: new Date().toISOString()
    };
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      console.error('Unhandled error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize file storage
      await fileStorage.readData('test');
      console.log('✅ File storage initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize file storage:', error);
      throw error;
    }
  }

  public getApp(): Application {
    return this.app;
  }
}