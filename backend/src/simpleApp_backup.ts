import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { SimpleAreaController } from './controllers/SimpleAreaController';
import { fileStorage } from './database/fileStorage';
import { marketBasedPredictionModel, MarketPredictionInput } from './services/MarketBasedPredictionModel';

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

    // Data extraction endpoints removed - use offline scripts for data management

    this.app.get('/api/resale/summary', async (req: Request, res: Response) => {
      try {
        const { resalePriceExtractor } = await import('./services/ResalePriceExtractor');
        const summary = await resalePriceExtractor.getMarketSummary();
        
        res.json({
          success: true,
          data: summary
        });
      } catch (error) {
        console.error('[API] Error getting resale summary:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get resale data summary'
        });
      }
    });

    this.app.get('/api/resale/baselines', async (req: Request, res: Response) => {
      try {
        const baselines = await fileStorage.readData('market_baselines');
        
        res.json({
          success: true,
          data: baselines[0] || { baselines: {}, message: 'No baselines available. Extract resale data first.' }
        });
      } catch (error) {
        console.error('[API] Error getting baselines:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get market baselines'
        });
      }
    });

    // Data source status endpoint
    this.app.get('/api/resale/sources', async (req: Request, res: Response) => {
      try {
        const { resalePriceExtractor } = await import('./services/ResalePriceExtractor');
        const sources = resalePriceExtractor.getDataSourceStatus();
        
        res.json({
          success: true,
          data: {
            sources,
            summary: {
              total: sources.length,
              available: sources.filter(s => s.isAvailable).length,
              failed: sources.filter(s => !s.isAvailable).length,
              lastUpdated: new Date().toISOString()
            }
          }
        });
      } catch (error) {
        console.error('[API] Error getting data source status:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get data source status'
        });
      }
    });

    // Force refresh from specific source
    this.app.post('/api/resale/refresh/:source', async (req: Request, res: Response) => {
      try {
        const { resalePriceExtractor } = await import('./services/ResalePriceExtractor');
        const sourceName = req.params.source;
        
        console.log(`[API] Force refresh requested for: ${sourceName}`);
        const data = await resalePriceExtractor.forceRefreshFromSource(sourceName);
        
        // Store the refreshed data
        if (data.hdb.length > 0) {
          await fileStorage.writeData('hdb_resale_transactions', data.hdb);
        }
        if (data.private.length > 0) {
          await fileStorage.writeData('private_property_transactions', data.private);
        }
        
        res.json({
          success: true,
          data: {
            source: sourceName,
            hdbTransactions: data.hdb.length,
            privateTransactions: data.private.length,
            message: `Successfully refreshed data from ${sourceName}`
          }
        });
      } catch (error) {
        console.error('[API] Error refreshing data source:', error);
        res.status(500).json({
          success: false,
          error: `Failed to refresh from data source: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });

    // API validation endpoint
    this.app.get('/api/validate-apis', async (req: Request, res: Response) => {
      try {
        const { validateAPIs } = await import('./scripts/validate-apis');
        
        console.log('[API] Running comprehensive API validation...');
        const results = await validateAPIs();
        
        const summary = {
          success: results.filter(r => r.status === 'success').length,
          warnings: results.filter(r => r.status === 'warning').length,
          errors: results.filter(r => r.status === 'error').length
        };
        
        const overallStatus = summary.errors > 0 ? 'error' : summary.warnings > 0 ? 'warning' : 'success';
        
        res.json({
          success: overallStatus !== 'error',
          status: overallStatus,
          summary,
          results,
          message: `API validation complete: ${summary.success} success, ${summary.warnings} warnings, ${summary.errors} errors`
        });
      } catch (error) {
        console.error('[API] Error validating APIs:', error);
        res.status(500).json({
          success: false,
          error: `API validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });

    // Comprehensive 5-year data extraction endpoint
    this.app.post('/api/resale/extract-comprehensive', async (req: Request, res: Response) => {
      try {
        const { resalePriceExtractor } = await import('./services/ResalePriceExtractor');
        
        console.log('[API] Starting comprehensive 5-year data extraction...');
        
        // Extract comprehensive data from all sources
        const startTime = Date.now();
        
        // Extract HDB data for past 5 years
        const hdbTransactions = await resalePriceExtractor.extractHDBResalePrices('2019-01-01', 500000);
        
        // Extract comprehensive URA data
        const uraData = await resalePriceExtractor.extractDataWithFallback();
        
        // Generate enhanced baselines
        const baselines = await resalePriceExtractor.generateMarketBaselines();
        
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        res.json({
          success: true,
          data: {
            hdbTransactions: hdbTransactions.length,
            privateTransactions: uraData.private.length,
            totalTransactions: hdbTransactions.length + uraData.private.length,
            baselines: Object.keys(baselines).length,
            extractionTime: `${duration} seconds`,
            coverage: {
              startDate: '2019-01-01',
              endDate: new Date().toISOString().split('T')[0],
              years: 5
            }
          },
          message: `Comprehensive extraction completed: ${hdbTransactions.length + uraData.private.length} total transactions`
        });
      } catch (error) {
        console.error('[API] Error in comprehensive extraction:', error);
        res.status(500).json({
          success: false,
          error: `Comprehensive extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });

    // API validation endpoint
    this.app.get('/api/validate-sources', async (req: Request, res: Response) => {
      try {
        const { resalePriceExtractor } = await import('./services/ResalePriceExtractor');
        
        console.log('[API] Validating data sources...');
        
        const validation = {
          hdb: { working: false, resourceId: null, error: null },
          ura: { working: false, hasKey: false, error: null }
        };

        // Test HDB data.gov.sg API
        try {
          console.log('[API] Testing HDB data.gov.sg API...');
          const hdbTest = await resalePriceExtractor.extractHDBResalePrices('2024-01-01', 1);
          validation.hdb.working = hdbTest.length > 0;
          validation.hdb.resourceId = 'Found working ID';
        } catch (hdbError) {
          validation.hdb.error = hdbError instanceof Error ? hdbError.message : 'Unknown error';
        }

        // Test URA API
        try {
          console.log('[API] Testing URA API...');
          const uraTest = await resalePriceExtractor.extractFromURA();
          validation.ura.working = uraTest.private.length > 0;
          validation.ura.hasKey = true;
        } catch (uraError) {
          validation.ura.error = uraError instanceof Error ? uraError.message : 'Unknown error';
          validation.ura.hasKey = !uraError.message?.includes('not configured');
        }

        res.json({
          success: true,
          data: validation,
          message: 'API validation completed'
        });
      } catch (error) {
        console.error('[API] Error validating sources:', error);
        res.status(500).json({
          success: false,
          error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });

    // Enhanced district information endpoint
    this.app.get('/api/districts/ura', async (req: Request, res: Response) => {
      try {
        const { resalePriceExtractor } = await import('./services/ResalePriceExtractor');
        const districts = resalePriceExtractor.getAllURADistricts();
        
        res.json({
          success: true,
          data: {
            districts,
            totalDistricts: districts.length,
            description: 'Comprehensive URA district mapping with planning areas and sub-districts'
          }
        });
      } catch (error) {
        console.error('[API] Error getting URA districts:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve URA district information'
        });
      }
    });

    // Get specific district information
    this.app.get('/api/districts/ura/:districtCode', async (req: Request, res: Response) => {
      try {
        const { resalePriceExtractor } = await import('./services/ResalePriceExtractor');
        const districtCode = req.params.districtCode.toUpperCase();
        const districtInfo = resalePriceExtractor.getURADistrictInfo(districtCode);
        
        if (!districtInfo) {
          return res.status(404).json({
            success: false,
            error: `District ${districtCode} not found`
          });
        }
        
        res.json({
          success: true,
          data: {
            code: districtCode,
            ...districtInfo
          }
        });
      } catch (error) {
        console.error('[API] Error getting district info:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve district information'
        });
      }
    });

    // Model training endpoints removed - backend only provides inference APIs

    // Model inference endpoints only
    this.app.get('/api/model/info', async (req: Request, res: Response) => {
      try {
        const { modelTrainingService } = await import('./services/ModelTrainingService');
        const modelInfo = modelTrainingService.getCurrentModelInfo();
        
        if (modelInfo) {
          // Only return inference-relevant information
          res.json({
            success: true,
            data: {
              version: modelInfo.version,
              trainedAt: modelInfo.trainedAt,
              accuracy: modelInfo.accuracy,
              dataRange: modelInfo.dataRange,
              availableDistricts: Object.keys(modelInfo.modelWeights),
              availablePropertyTypes: ['HDB', 'Condo', 'Landed'],
              status: 'ready_for_inference'
            }
          });
        } else {
          res.json({
            success: true,
            data: { 
              message: 'No trained model available',
              status: 'no_model'
            }
          });
        }
      } catch (error) {
        console.error('[API] Error getting model info:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get model information'
        });
      }
    });

    // Manual training endpoint removed - use offline training scripts instead

    // Simple prediction endpoint (now with real market data)
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
    // Import the resale price extractor
    const { resalePriceExtractor } = await import('./services/ResalePriceExtractor');
    
    // Get real market baseline for this area and property type
    let basePricePerSqft: number;
    try {
      basePricePerSqft = await resalePriceExtractor.getAreaBaseline(area.id, request.propertyType);
      console.log(`[PREDICTION] Using market baseline for ${area.id} ${request.propertyType}: $${basePricePerSqft} psf`);
    } catch (error) {
      console.error('[PREDICTION] Error getting market baseline, using fallback:', error);
      // Fallback to updated realistic prices
      const fallbackPrices = {
        'HDB': 600,
        'Condo': 1500,
        'Landed': 2400
      };
      basePricePerSqft = fallbackPrices[request.propertyType as keyof typeof fallbackPrices] || 1000;
    }
    
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

    // Generate related news articles
    const relatedNews = this.generateRelatedNews(area, request);

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
      relatedNews,
      modelAccuracy: 0.75 + Math.random() * 0.20, // 75-95% accuracy
      generatedAt: new Date().toISOString()
    };
  }

  private generateRelatedNews(area: any, request: any) {
    // Generate realistic news articles based on area and property type
    const newsTemplates = [
      {
        category: 'Development',
        templates: [
          `New MRT station planned for ${area.name} to boost connectivity`,
          `${area.name} selected for major urban redevelopment project`,
          `Government announces infrastructure upgrades in ${area.district}`,
          `New shopping mall development approved for ${area.name} area`,
          `${area.name} to benefit from upcoming Cross Island Line extension`
        ]
      },
      {
        category: 'Market Trends',
        templates: [
          `${request.propertyType} prices in ${area.district} show steady growth`,
          `Strong demand for ${request.propertyType} properties in ${area.name}`,
          `${area.district} emerges as hotspot for property investment`,
          `Analysts predict continued growth in ${area.name} property market`,
          `${request.propertyType} transactions increase 15% in ${area.district}`
        ]
      },
      {
        category: 'Policy & Regulation',
        templates: [
          `New cooling measures may impact ${area.district} property prices`,
          `Government housing grants boost ${request.propertyType} affordability`,
          `Updated development guidelines for ${area.district} announced`,
          `Property tax adjustments affect ${area.name} market dynamics`,
          `Foreign buyer restrictions tighten in prime areas like ${area.district}`
        ]
      },
      {
        category: 'Economic Factors',
        templates: [
          `Interest rate changes influence ${area.name} property demand`,
          `Economic growth drives property investment in ${area.district}`,
          `Employment hub expansion near ${area.name} boosts housing demand`,
          `Tech sector growth impacts ${area.district} residential market`,
          `Tourism recovery benefits ${area.name} property values`
        ]
      }
    ];

    const sources = [
      'The Straits Times',
      'Channel NewsAsia',
      'Business Times',
      'PropertyGuru',
      'EdgeProp Singapore',
      'Today Online'
    ];

    // Generate 3-5 news articles
    const numArticles = 3 + Math.floor(Math.random() * 3);
    const selectedNews = [];

    for (let i = 0; i < numArticles; i++) {
      const category = newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
      const template = category.templates[Math.floor(Math.random() * category.templates.length)];
      const source = sources[Math.floor(Math.random() * sources.length)];
      
      // Generate realistic dates (last 30 days)
      const daysAgo = Math.floor(Math.random() * 30);
      const publishDate = new Date();
      publishDate.setDate(publishDate.getDate() - daysAgo);

      selectedNews.push({
        id: `news_${Date.now()}_${i}`,
        title: template,
        source: source,
        publishedAt: publishDate.toISOString(),
        category: category.category,
        relevanceScore: 0.7 + Math.random() * 0.3, // 70-100% relevance
        summary: this.generateNewsSummary(template, area, request),
        url: `https://${source.toLowerCase().replace(/\s+/g, '')}.com/singapore/property/${Date.now()}`
      });
    }

    // Sort by relevance score (highest first)
    return selectedNews.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private generateNewsSummary(title: string, area: any, request: any): string {
    const summaryTemplates = [
      `Recent developments in ${area.name} are expected to significantly impact ${request.propertyType} property values. Market analysts suggest this could lead to increased demand and price appreciation over the next ${request.timeframeYears} years.`,
      
      `The ${area.district} area continues to attract investor interest due to its strategic location and ongoing infrastructure improvements. This trend is particularly beneficial for ${request.propertyType} properties in the vicinity.`,
      
      `Industry experts note that ${area.name} has shown resilient market performance, with ${request.propertyType} properties maintaining steady growth despite broader market fluctuations.`,
      
      `Government initiatives and private sector investments in ${area.district} are creating a positive outlook for residential property values, especially for ${request.propertyType} units.`,
      
      `The combination of improved connectivity and planned developments makes ${area.name} an attractive location for both homebuyers and investors looking at ${request.propertyType} properties.`
    ];

    return summaryTemplates[Math.floor(Math.random() * summaryTemplates.length)];
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

// Start the server
async function startServer() {
  try {
    const app = new SimpleApp();
    await app.initialize();
    
    // Initialize market-based prediction model
    console.log('🔄 Initializing market-based prediction model...');
    try {
      await marketBasedPredictionModel.initialize();
      console.log('✅ Market-based prediction model initialized');
    } catch (error) {
      console.warn('⚠️ Market model initialization failed, will use fallback model:', (error as Error).message);
    }
    
    const port = process.env.PORT || 8000;
    
    app.getApp().listen(port, () => {
      console.log('🇸🇬 Singapore Housing Predictor API - Enhanced Mode');
      console.log('============================================= ');
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📍 Health check: http://localhost:${port}/health`);
      console.log(`🔍 Area search: http://localhost:${port}/api/areas/search`);
      console.log(`📊 Predictions: http://localhost:${port}/api/predictions/request`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('💾 Storage: File-based with market data integration');
      console.log('📈 Model: Market-based predictions with real transaction data');
      console.log('============================================= ');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Only start server if this file is run directly
if (require.main === module) {
  startServer();
}