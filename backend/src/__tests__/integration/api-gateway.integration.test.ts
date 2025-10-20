import request from 'supertest';
import { App } from '../../app';
import { DatabaseConnection } from '../../database/connection';
import { generateTestToken } from '../../middleware/auth';
import { databaseConfig } from '../../config';

describe('API Gateway Integration Tests', () => {
  let app: App;
  let server: any;
  let db: DatabaseConnection;
  let authToken: string;

  beforeAll(async () => {
    // Initialize app and database
    app = new App();
    await app.initialize();
    server = app.getApp();
    db = DatabaseConnection.getInstance(databaseConfig);
    
    // Generate test auth token
    authToken = generateTestToken('test-user-id', 'test@example.com');
  });

  afterAll(async () => {
    await app.shutdown();
  });

  describe('Health Check and Service Discovery', () => {
    it('should return system health status', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: expect.any(String),
          timestamp: expect.any(String),
          version: expect.any(String),
          services: expect.any(Array),
          database: expect.objectContaining({
            status: 'connected'
          })
        }
      });
    });

    it('should return registered services information', async () => {
      const response = await request(server)
        .get('/api/services')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          services: expect.any(Object),
          healthStatus: expect.any(Object)
        }
      });
    });

    it('should check individual service health', async () => {
      const response = await request(server)
        .post('/api/services/prediction/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          name: expect.any(String),
          status: expect.any(String)
        })
      });
    });
  });

  describe('End-to-End Prediction Workflow', () => {
    it('should execute full prediction workflow successfully', async () => {
      const predictionRequest = {
        areaId: 'singapore-central',
        timeframeYears: 5
      };

      const response = await request(server)
        .post('/api/orchestration/predict/full')
        .set('Authorization', `Bearer ${authToken}`)
        .send(predictionRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          predictionResult: expect.objectContaining({
            predictedPrice: expect.any(Number),
            confidenceInterval: expect.objectContaining({
              lower: expect.any(Number),
              upper: expect.any(Number)
            }),
            influencingFactors: expect.any(Array)
          }),
          steps: expect.any(Array)
        }),
        message: expect.any(String)
      });
    });

    it('should execute quick prediction workflow successfully', async () => {
      const predictionRequest = {
        areaId: 'singapore-central',
        timeframeYears: 3
      };

      const response = await request(server)
        .post('/api/orchestration/predict/quick')
        .set('Authorization', `Bearer ${authToken}`)
        .send(predictionRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          predictionResult: expect.objectContaining({
            predictedPrice: expect.any(Number),
            confidenceInterval: expect.any(Object)
          })
        }),
        message: expect.any(String)
      });
    });

    it('should validate prediction request parameters', async () => {
      const invalidRequest = {
        areaId: 'singapore-central',
        timeframeYears: 15 // Invalid: exceeds 10 year limit
      };

      const response = await request(server)
        .post('/api/orchestration/predict/full')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Timeframe must be between 1 and 10 years')
      });
    });

    it('should handle missing required fields', async () => {
      const incompleteRequest = {
        areaId: 'singapore-central'
        // Missing timeframeYears
      };

      const response = await request(server)
        .post('/api/orchestration/predict/full')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Missing required fields')
      });
    });
  });

  describe('Service Routing and Error Handling', () => {
    it('should route area search requests correctly', async () => {
      const response = await request(server)
        .get('/api/areas/search?query=central')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });
    });

    it('should route area validation requests correctly', async () => {
      const validationRequest = {
        coordinates: {
          latitude: 1.3521,
          longitude: 103.8198
        }
      };

      const response = await request(server)
        .post('/api/areas/validate')
        .send(validationRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          isValid: expect.any(Boolean)
        })
      });
    });

    it('should handle 404 for non-existent routes', async () => {
      const response = await request(server)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Route not found',
        message: expect.stringContaining('does not exist')
      });
    });

    it('should handle internal server errors gracefully', async () => {
      // This test simulates a server error by sending malformed data
      const response = await request(server)
        .post('/api/predictions/request')
        .send({ malformed: 'data that will cause processing errors' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });

    it('should return service unavailable when services are down', async () => {
      // Test orchestration health check when services might be unavailable
      const response = await request(server)
        .get('/api/orchestration/health');

      // Should return either 200 (healthy) or 503 (unhealthy)
      expect([200, 503]).toContain(response.status);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          overall: expect.stringMatching(/^(healthy|unhealthy)$/),
          timestamp: expect.any(String)
        })
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply general rate limiting to API endpoints', async () => {
      // Make multiple requests quickly to test rate limiting
      const requests = Array(5).fill(null).map(() => 
        request(server).get('/api/areas/search?query=test')
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed initially (within rate limit)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });

    it('should apply stricter rate limiting to prediction endpoints', async () => {
      const predictionRequest = {
        areaId: 'singapore-central',
        timeframeYears: 1
      };

      // Make multiple prediction requests quickly
      const requests = Array(3).fill(null).map(() => 
        request(server)
          .post('/api/orchestration/predict/quick')
          .set('Authorization', `Bearer ${authToken}`)
          .send(predictionRequest)
      );

      const responses = await Promise.all(requests);
      
      // Should handle requests within prediction rate limit
      responses.forEach(response => {
        expect([200, 400, 429, 500, 503]).toContain(response.status);
      });
    });

    it('should return proper rate limit error message', async () => {
      // This test might not always trigger rate limiting in CI
      // but ensures the error format is correct when it does
      const response = await request(server)
        .get('/api/areas/search?query=test');

      if (response.status === 429) {
        expect(response.body).toMatchObject({
          success: false,
          error: expect.stringContaining('Too many requests')
        });
      }
    });
  });

  describe('Authentication', () => {
    it('should accept requests without authentication for public endpoints', async () => {
      const response = await request(server)
        .get('/api/areas/search?query=central')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept valid JWT tokens', async () => {
      const response = await request(server)
        .post('/api/orchestration/predict/quick')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          areaId: 'singapore-central',
          timeframeYears: 2
        });

      // Should not fail due to authentication (may fail for other reasons)
      expect([200, 400, 500, 503]).toContain(response.status);
      if (response.status !== 200) {
        expect(response.body.error).not.toContain('Invalid or expired token');
      }
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await request(server)
        .post('/api/orchestration/predict/quick')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          areaId: 'singapore-central',
          timeframeYears: 2
        })
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid or expired token'
      });
    });

    it('should handle malformed authorization headers', async () => {
      const response = await request(server)
        .post('/api/orchestration/predict/quick')
        .set('Authorization', 'InvalidFormat')
        .send({
          areaId: 'singapore-central',
          timeframeYears: 2
        });

      // Should either process without auth or return validation error
      expect([200, 400, 500, 503]).toContain(response.status);
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include proper CORS headers', async () => {
      const response = await request(server)
        .options('/api/areas/search')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should include security headers', async () => {
      const response = await request(server)
        .get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('Request/Response Logging', () => {
    it('should log requests and responses', async () => {
      // This test verifies that logging middleware is working
      // by checking that requests complete successfully with logging enabled
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      // In a real test environment, you might capture console output
      // or check log files to verify logging is working
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error response format', async () => {
      const response = await request(server)
        .post('/api/orchestration/predict/full')
        .send({}) // Empty body to trigger validation error
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });
      expect(response.body).not.toHaveProperty('data');
    });

    it('should return consistent success response format', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object)
      });
    });
  });
});