import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface ServiceConfig {
  name: string;
  baseUrl: string;
  timeout?: number;
  retries?: number;
  healthCheckPath?: string;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}

/**
 * Service registry for managing microservice connections
 */
export class ServiceRegistry {
  private services: Map<string, ServiceConfig> = new Map();
  private clients: Map<string, AxiosInstance> = new Map();
  private healthStatus: Map<string, ServiceHealth> = new Map();

  constructor() {
    this.initializeServices();
  }

  /**
   * Initialize default services
   */
  private initializeServices(): void {
    // ML Service (Python)
    this.registerService({
      name: 'ml-service',
      baseUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
      timeout: 30000, // 30 seconds for ML operations
      retries: 2,
      healthCheckPath: '/health'
    });

    // Web Crawler Service (could be separate service in future)
    this.registerService({
      name: 'crawler-service',
      baseUrl: process.env.CRAWLER_SERVICE_URL || 'http://localhost:3001', // Same as main API for now
      timeout: 60000, // 60 seconds for crawling
      retries: 1,
      healthCheckPath: '/health'
    });

    // Data Processing Service (could be separate service in future)
    this.registerService({
      name: 'processing-service',
      baseUrl: process.env.PROCESSING_SERVICE_URL || 'http://localhost:3001', // Same as main API for now
      timeout: 30000,
      retries: 2,
      healthCheckPath: '/health'
    });
  }

  /**
   * Register a new service
   */
  public registerService(config: ServiceConfig): void {
    this.services.set(config.name, config);
    
    // Create axios client for the service
    const client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Singapore-Housing-Predictor-Gateway/1.0'
      }
    });

    // Add retry logic
    this.addRetryInterceptor(client, config.retries || 1);
    
    this.clients.set(config.name, client);
    
    // Initialize health status
    this.healthStatus.set(config.name, {
      name: config.name,
      status: 'unknown',
      lastChecked: new Date()
    });
  }

  /**
   * Add retry interceptor to axios client
   */
  private addRetryInterceptor(client: AxiosInstance, maxRetries: number): void {
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        
        if (!config || !config.retry) {
          config.retry = 0;
        }
        
        if (config.retry < maxRetries && this.shouldRetry(error)) {
          config.retry++;
          console.log(`Retrying request (attempt ${config.retry}/${maxRetries}):`, config.url);
          
          // Exponential backoff
          const delay = Math.pow(2, config.retry) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return client(config);
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: any): boolean {
    // Retry on network errors or 5xx status codes
    return !error.response || (error.response.status >= 500 && error.response.status < 600);
  }

  /**
   * Get service client
   */
  public getServiceClient(serviceName: string): AxiosInstance | null {
    return this.clients.get(serviceName) || null;
  }

  /**
   * Make request to a service
   */
  public async makeRequest<T = any>(
    serviceName: string,
    path: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const client = this.getServiceClient(serviceName);
    
    if (!client) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    try {
      const response = await client.request({
        url: path,
        ...config
      });
      
      return response.data;
    } catch (error: any) {
      console.error(`Request to ${serviceName}${path} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Check health of a specific service
   */
  public async checkServiceHealth(serviceName: string): Promise<ServiceHealth> {
    const service = this.services.get(serviceName);
    const client = this.clients.get(serviceName);
    
    if (!service || !client) {
      const health: ServiceHealth = {
        name: serviceName,
        status: 'unknown',
        lastChecked: new Date(),
        error: 'Service not registered'
      };
      this.healthStatus.set(serviceName, health);
      return health;
    }

    const startTime = Date.now();
    
    try {
      const healthPath = service.healthCheckPath || '/health';
      await client.get(healthPath, { timeout: 5000 });
      
      const responseTime = Date.now() - startTime;
      const health: ServiceHealth = {
        name: serviceName,
        status: 'healthy',
        responseTime,
        lastChecked: new Date()
      };
      
      this.healthStatus.set(serviceName, health);
      return health;
      
    } catch (error: any) {
      const health: ServiceHealth = {
        name: serviceName,
        status: 'unhealthy',
        lastChecked: new Date(),
        error: error.message
      };
      
      this.healthStatus.set(serviceName, health);
      return health;
    }
  }

  /**
   * Check health of all services
   */
  public async checkAllServicesHealth(): Promise<ServiceHealth[]> {
    const healthChecks = Array.from(this.services.keys()).map(
      serviceName => this.checkServiceHealth(serviceName)
    );
    
    return Promise.all(healthChecks);
  }

  /**
   * Get current health status of all services
   */
  public getAllHealthStatus(): ServiceHealth[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get list of registered services
   */
  public getRegisteredServices(): ServiceConfig[] {
    return Array.from(this.services.values());
  }
}