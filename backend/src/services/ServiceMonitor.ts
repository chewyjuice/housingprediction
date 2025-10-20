import { ServiceRegistry, ServiceHealth } from './ServiceRegistry';
import { DatabaseConnection } from '../database/connection';

export interface MonitoringMetrics {
  timestamp: Date;
  serviceName: string;
  responseTime: number;
  status: 'healthy' | 'unhealthy' | 'unknown';
  errorCount: number;
  requestCount: number;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: number;
  activeConnections: number;
  totalRequests: number;
  errorRate: number;
}

/**
 * Service monitoring and health checking system
 */
export class ServiceMonitor {
  private serviceRegistry: ServiceRegistry;
  private db: DatabaseConnection;
  private metrics: Map<string, MonitoringMetrics[]> = new Map();
  private systemMetrics: SystemMetrics;
  private monitoringInterval?: NodeJS.Timeout;
  private startTime: Date;
  private requestCount: number = 0;
  private errorCount: number = 0;

  constructor(serviceRegistry: ServiceRegistry, db: DatabaseConnection) {
    this.serviceRegistry = serviceRegistry;
    this.db = db;
    this.startTime = new Date();
    this.systemMetrics = this.initializeSystemMetrics();
  }

  /**
   * Start monitoring services
   */
  public startMonitoring(intervalMs: number = 30000): void {
    console.log('🔍 Starting service monitoring...');
    
    // Initial health check
    this.performHealthChecks();
    
    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
      this.updateSystemMetrics();
      this.cleanupOldMetrics();
    }, intervalMs);
  }

  /**
   * Stop monitoring services
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('🔍 Service monitoring stopped');
    }
  }

  /**
   * Perform health checks on all services
   */
  public async performHealthChecks(): Promise<ServiceHealth[]> {
    try {
      const services = this.serviceRegistry.getRegisteredServices();
      const healthChecks: Promise<ServiceHealth>[] = [];

      for (const service of services) {
        healthChecks.push(this.checkServiceWithMetrics(service.name));
      }

      const results = await Promise.all(healthChecks);
      
      // Log unhealthy services
      const unhealthyServices = results.filter(result => result.status !== 'healthy');
      if (unhealthyServices.length > 0) {
        console.warn('⚠️ Unhealthy services detected:', unhealthyServices.map(s => s.name));
      }

      return results;

    } catch (error) {
      console.error('Health check failed:', error);
      return [];
    }
  }

  /**
   * Check service health and record metrics
   */
  private async checkServiceWithMetrics(serviceName: string): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const health = await this.serviceRegistry.checkServiceHealth(serviceName);
      const responseTime = Date.now() - startTime;
      
      // Record metrics
      this.recordServiceMetrics(serviceName, responseTime, health.status, health.error ? 1 : 0);
      
      return health;

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // Record error metrics
      this.recordServiceMetrics(serviceName, responseTime, 'unhealthy', 1);
      
      return {
        name: serviceName,
        status: 'unhealthy',
        lastChecked: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Record service metrics
   */
  private recordServiceMetrics(
    serviceName: string, 
    responseTime: number, 
    status: 'healthy' | 'unhealthy' | 'unknown',
    errorCount: number
  ): void {
    if (!this.metrics.has(serviceName)) {
      this.metrics.set(serviceName, []);
    }

    const serviceMetrics = this.metrics.get(serviceName)!;
    const existingMetric = serviceMetrics[serviceMetrics.length - 1];
    
    const newMetric: MonitoringMetrics = {
      timestamp: new Date(),
      serviceName,
      responseTime,
      status,
      errorCount: (existingMetric?.errorCount || 0) + errorCount,
      requestCount: (existingMetric?.requestCount || 0) + 1
    };

    serviceMetrics.push(newMetric);
  }

  /**
   * Get service metrics for a specific service
   */
  public getServiceMetrics(serviceName: string, hours: number = 24): MonitoringMetrics[] {
    const serviceMetrics = this.metrics.get(serviceName) || [];
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    return serviceMetrics.filter(metric => metric.timestamp >= cutoffTime);
  }

  /**
   * Get aggregated metrics for all services
   */
  public getAggregatedMetrics(hours: number = 24): {
    serviceName: string;
    averageResponseTime: number;
    uptime: number;
    errorRate: number;
    totalRequests: number;
  }[] {
    const results: any[] = [];
    
    for (const [serviceName, metrics] of this.metrics.entries()) {
      const recentMetrics = this.getServiceMetrics(serviceName, hours);
      
      if (recentMetrics.length === 0) {
        continue;
      }

      const totalRequests = recentMetrics.length;
      const totalErrors = recentMetrics.reduce((sum, m) => sum + m.errorCount, 0);
      const averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
      const healthyChecks = recentMetrics.filter(m => m.status === 'healthy').length;
      const uptime = (healthyChecks / totalRequests) * 100;
      const errorRate = (totalErrors / totalRequests) * 100;

      results.push({
        serviceName,
        averageResponseTime: Math.round(averageResponseTime),
        uptime: Math.round(uptime * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        totalRequests
      });
    }

    return results;
  }

  /**
   * Get current system metrics
   */
  public getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    this.systemMetrics = {
      uptime: Date.now() - this.startTime.getTime(),
      memoryUsage: process.memoryUsage(),
      activeConnections: 0, // Would need to track this separately
      totalRequests: this.requestCount,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0
    };
  }

  /**
   * Initialize system metrics
   */
  private initializeSystemMetrics(): SystemMetrics {
    return {
      uptime: 0,
      memoryUsage: process.memoryUsage(),
      activeConnections: 0,
      totalRequests: 0,
      errorRate: 0
    };
  }

  /**
   * Clean up old metrics (keep only last 7 days)
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 7 days
    
    for (const [serviceName, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(metric => metric.timestamp >= cutoffTime);
      this.metrics.set(serviceName, filteredMetrics);
    }
  }

  /**
   * Increment request counter
   */
  public incrementRequestCount(): void {
    this.requestCount++;
  }

  /**
   * Increment error counter
   */
  public incrementErrorCount(): void {
    this.errorCount++;
  }

  /**
   * Get monitoring dashboard data
   */
  public async getDashboardData(): Promise<{
    systemHealth: 'healthy' | 'degraded' | 'critical';
    systemMetrics: SystemMetrics;
    serviceMetrics: any[];
    recentAlerts: string[];
  }> {
    try {
      const serviceHealth = await this.performHealthChecks();
      const aggregatedMetrics = this.getAggregatedMetrics(1); // Last hour
      
      // Determine overall system health
      const unhealthyServices = serviceHealth.filter(s => s.status !== 'healthy');
      let systemHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
      
      if (unhealthyServices.length > 0) {
        systemHealth = unhealthyServices.length >= serviceHealth.length / 2 ? 'critical' : 'degraded';
      }

      // Generate recent alerts
      const recentAlerts: string[] = [];
      for (const service of unhealthyServices) {
        recentAlerts.push(`Service ${service.name} is ${service.status}: ${service.error || 'Unknown error'}`);
      }

      return {
        systemHealth,
        systemMetrics: this.getSystemMetrics(),
        serviceMetrics: aggregatedMetrics,
        recentAlerts
      };

    } catch (error: any) {
      console.error('Failed to get dashboard data:', error);
      return {
        systemHealth: 'critical',
        systemMetrics: this.getSystemMetrics(),
        serviceMetrics: [],
        recentAlerts: [`Dashboard error: ${error.message}`]
      };
    }
  }

  /**
   * Check if database is healthy
   */
  public async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Test database connection with a simple query
      await this.db.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'database',
        status: 'healthy',
        responseTime,
        lastChecked: new Date()
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date(),
        error: error.message
      };
    }
  }
}