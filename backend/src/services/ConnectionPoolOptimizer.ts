import { DatabaseConnection } from '../database/connection';

export interface PoolOptimizationConfig {
  targetUtilization: number; // Target pool utilization percentage (default: 70)
  scaleUpThreshold: number; // Scale up when utilization exceeds this (default: 80)
  scaleDownThreshold: number; // Scale down when utilization below this (default: 30)
  minConnections: number; // Minimum connections to maintain
  maxConnections: number; // Maximum connections allowed
  monitoringInterval: number; // Monitoring interval in milliseconds
}

export interface PoolMetrics {
  timestamp: Date;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  utilization: number;
  avgQueryTime: number;
  slowQueries: number;
}

export class ConnectionPoolOptimizer {
  private db: DatabaseConnection;
  private config: PoolOptimizationConfig;
  private metricsHistory: PoolMetrics[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private isOptimizing = false;

  constructor(
    db: DatabaseConnection,
    config: Partial<PoolOptimizationConfig> = {}
  ) {
    this.db = db;
    this.config = {
      targetUtilization: 70,
      scaleUpThreshold: 80,
      scaleDownThreshold: 30,
      minConnections: 5,
      maxConnections: 50,
      monitoringInterval: 30000, // 30 seconds
      ...config
    };
  }

  public startMonitoring(): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    console.log('Starting connection pool monitoring...');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.optimizePool();
      } catch (error) {
        console.error('Error during pool monitoring:', error);
      }
    }, this.config.monitoringInterval);

    // Initial metrics collection
    this.collectMetrics();
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('Stopped connection pool monitoring');
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const poolInfo = this.db.getPoolInfo();
      const performanceMetrics = await this.db.getPerformanceMetrics();

      const metrics: PoolMetrics = {
        timestamp: new Date(),
        totalConnections: poolInfo.totalCount,
        activeConnections: poolInfo.totalCount - poolInfo.idleCount,
        idleConnections: poolInfo.idleCount,
        waitingConnections: poolInfo.waitingCount,
        utilization: (poolInfo.totalCount / poolInfo.maxConnections) * 100,
        avgQueryTime: performanceMetrics.avgQueryTime,
        slowQueries: performanceMetrics.slowQueries
      };

      this.metricsHistory.push(metrics);

      // Keep only last 100 metrics (about 50 minutes at 30s intervals)
      if (this.metricsHistory.length > 100) {
        this.metricsHistory = this.metricsHistory.slice(-100);
      }

      // Log metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Pool Metrics:', {
          utilization: `${metrics.utilization.toFixed(1)}%`,
          active: metrics.activeConnections,
          idle: metrics.idleConnections,
          waiting: metrics.waitingConnections,
          avgQueryTime: `${metrics.avgQueryTime.toFixed(2)}ms`
        });
      }
    } catch (error) {
      console.error('Failed to collect pool metrics:', error);
    }
  }

  private async optimizePool(): Promise<void> {
    if (this.isOptimizing || this.metricsHistory.length < 3) {
      return; // Need at least 3 data points for trend analysis
    }

    this.isOptimizing = true;

    try {
      const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
      const recommendations = this.analyzeMetrics(currentMetrics);

      for (const recommendation of recommendations) {
        await this.applyRecommendation(recommendation);
      }
    } catch (error) {
      console.error('Error during pool optimization:', error);
    } finally {
      this.isOptimizing = false;
    }
  }

  private analyzeMetrics(current: PoolMetrics): Array<{
    type: 'scale_up' | 'scale_down' | 'tune_timeouts' | 'alert';
    reason: string;
    action: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const recommendations: Array<{
      type: 'scale_up' | 'scale_down' | 'tune_timeouts' | 'alert';
      reason: string;
      action: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // Analyze utilization trends
    const recentMetrics = this.metricsHistory.slice(-5); // Last 5 measurements
    const avgUtilization = recentMetrics.reduce((sum, m) => sum + m.utilization, 0) / recentMetrics.length;
    const avgWaiting = recentMetrics.reduce((sum, m) => sum + m.waitingConnections, 0) / recentMetrics.length;

    // High utilization or waiting connections
    if (avgUtilization > this.config.scaleUpThreshold || avgWaiting > 0) {
      recommendations.push({
        type: 'scale_up',
        reason: `High utilization (${avgUtilization.toFixed(1)}%) or waiting connections (${avgWaiting.toFixed(1)})`,
        action: 'Increase pool size',
        priority: avgWaiting > 0 ? 'high' : 'medium'
      });
    }

    // Low utilization
    if (avgUtilization < this.config.scaleDownThreshold && current.totalConnections > this.config.minConnections) {
      recommendations.push({
        type: 'scale_down',
        reason: `Low utilization (${avgUtilization.toFixed(1)}%)`,
        action: 'Decrease pool size',
        priority: 'low'
      });
    }

    // High query times
    if (current.avgQueryTime > 1000) {
      recommendations.push({
        type: 'alert',
        reason: `High average query time (${current.avgQueryTime.toFixed(2)}ms)`,
        action: 'Investigate slow queries',
        priority: 'high'
      });
    }

    // Many slow queries
    if (current.slowQueries > 10) {
      recommendations.push({
        type: 'alert',
        reason: `Many slow queries detected (${current.slowQueries})`,
        action: 'Review and optimize queries',
        priority: 'high'
      });
    }

    return recommendations;
  }

  private async applyRecommendation(recommendation: {
    type: 'scale_up' | 'scale_down' | 'tune_timeouts' | 'alert';
    reason: string;
    action: string;
    priority: 'high' | 'medium' | 'low';
  }): Promise<void> {
    console.log(`Pool Optimization: ${recommendation.action} - ${recommendation.reason}`);

    switch (recommendation.type) {
      case 'scale_up':
        await this.scaleUpPool();
        break;
      case 'scale_down':
        await this.scaleDownPool();
        break;
      case 'alert':
        // Log alerts for monitoring systems
        console.warn(`Pool Alert [${recommendation.priority.toUpperCase()}]: ${recommendation.reason}`);
        break;
    }
  }

  private async scaleUpPool(): Promise<void> {
    const poolInfo = this.db.getPoolInfo();
    const newSize = Math.min(poolInfo.maxConnections + 5, this.config.maxConnections);
    
    if (newSize > poolInfo.maxConnections) {
      console.log(`Scaling up pool from ${poolInfo.maxConnections} to ${newSize} connections`);
      // Note: Actual pool resizing would require pool reconfiguration
      // This is a placeholder for the scaling logic
    }
  }

  private async scaleDownPool(): Promise<void> {
    const poolInfo = this.db.getPoolInfo();
    const newSize = Math.max(poolInfo.maxConnections - 2, this.config.minConnections);
    
    if (newSize < poolInfo.maxConnections && poolInfo.totalCount > this.config.minConnections) {
      console.log(`Scaling down pool from ${poolInfo.maxConnections} to ${newSize} connections`);
      // Note: Actual pool resizing would require pool reconfiguration
      // This is a placeholder for the scaling logic
    }
  }

  public getMetricsHistory(): PoolMetrics[] {
    return [...this.metricsHistory];
  }

  public getCurrentMetrics(): PoolMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null;
  }

  public getOptimizationReport(): {
    summary: string;
    currentStatus: {
      utilization: number;
      health: 'healthy' | 'warning' | 'critical';
      recommendations: string[];
    };
    trends: {
      utilizationTrend: 'increasing' | 'decreasing' | 'stable';
      performanceTrend: 'improving' | 'degrading' | 'stable';
    };
    history: PoolMetrics[];
  } {
    if (this.metricsHistory.length === 0) {
      return {
        summary: 'No metrics available',
        currentStatus: {
          utilization: 0,
          health: 'warning',
          recommendations: ['Start monitoring to collect metrics']
        },
        trends: {
          utilizationTrend: 'stable',
          performanceTrend: 'stable'
        },
        history: []
      };
    }

    const current = this.getCurrentMetrics()!;
    const recommendations = this.analyzeMetrics(current);
    
    // Determine health status
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (current.waitingConnections > 0 || current.utilization > 90) {
      health = 'critical';
    } else if (current.utilization > 80 || current.avgQueryTime > 500) {
      health = 'warning';
    }

    // Calculate trends
    const trends = this.calculateTrends();

    return {
      summary: `Pool utilization: ${current.utilization.toFixed(1)}%, Health: ${health}`,
      currentStatus: {
        utilization: current.utilization,
        health,
        recommendations: recommendations.map(r => r.action)
      },
      trends,
      history: this.metricsHistory
    };
  }

  private calculateTrends(): {
    utilizationTrend: 'increasing' | 'decreasing' | 'stable';
    performanceTrend: 'improving' | 'degrading' | 'stable';
  } {
    if (this.metricsHistory.length < 5) {
      return {
        utilizationTrend: 'stable',
        performanceTrend: 'stable'
      };
    }

    const recent = this.metricsHistory.slice(-5);
    const older = this.metricsHistory.slice(-10, -5);

    const recentAvgUtil = recent.reduce((sum, m) => sum + m.utilization, 0) / recent.length;
    const olderAvgUtil = older.reduce((sum, m) => sum + m.utilization, 0) / older.length;

    const recentAvgQuery = recent.reduce((sum, m) => sum + m.avgQueryTime, 0) / recent.length;
    const olderAvgQuery = older.reduce((sum, m) => sum + m.avgQueryTime, 0) / older.length;

    const utilizationTrend = 
      recentAvgUtil > olderAvgUtil + 5 ? 'increasing' :
      recentAvgUtil < olderAvgUtil - 5 ? 'decreasing' : 'stable';

    const performanceTrend = 
      recentAvgQuery > olderAvgQuery + 50 ? 'degrading' :
      recentAvgQuery < olderAvgQuery - 50 ? 'improving' : 'stable';

    return { utilizationTrend, performanceTrend };
  }
}

export default ConnectionPoolOptimizer;