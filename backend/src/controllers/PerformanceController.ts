import { Request, Response } from 'express';
import { DatabaseConnection } from '../database/connection';
import { DatabasePerformanceMonitor } from '../services/DatabasePerformanceMonitor';
import { QueryOptimizer } from '../services/QueryOptimizer';

export class PerformanceController {
  private performanceMonitor: DatabasePerformanceMonitor;
  private queryOptimizer: QueryOptimizer;

  constructor(db: DatabaseConnection) {
    this.performanceMonitor = new DatabasePerformanceMonitor(db);
    this.queryOptimizer = new QueryOptimizer(db);
  }

  public getMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const metrics = await this.performanceMonitor.getComprehensiveMetrics();
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve performance metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public getConnectionPoolHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const health = await this.performanceMonitor.getConnectionPoolHealth();
      
      res.json({
        success: true,
        data: health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting connection pool health:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve connection pool health',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public getSlowQueries = async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const slowQueries = await this.performanceMonitor.getSlowQueries(limit);
      
      res.json({
        success: true,
        data: slowQueries,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting slow queries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve slow queries',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public getIndexEfficiency = async (req: Request, res: Response): Promise<void> => {
    try {
      const efficiency = await this.performanceMonitor.getIndexEfficiency();
      
      res.json({
        success: true,
        data: efficiency,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting index efficiency:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve index efficiency',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public getTableBloat = async (req: Request, res: Response): Promise<void> => {
    try {
      const bloat = await this.performanceMonitor.getTableBloat();
      
      res.json({
        success: true,
        data: bloat,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting table bloat:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve table bloat information',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public runPerformanceAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
      const analysis = await this.performanceMonitor.runPerformanceAnalysis();
      
      res.json({
        success: true,
        data: analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error running performance analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run performance analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public optimizeDatabase = async (req: Request, res: Response): Promise<void> => {
    try {
      const optimization = await this.performanceMonitor.optimizeDatabase();
      
      res.json({
        success: true,
        data: optimization,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error optimizing database:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize database',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public analyzeQuery = async (req: Request, res: Response): Promise<void> => {
    try {
      const { query, params } = req.body;
      
      if (!query) {
        res.status(400).json({
          success: false,
          error: 'Query is required'
        });
        return;
      }

      const analysis = await this.queryOptimizer.analyzeQuery(query, params);
      
      res.json({
        success: true,
        data: analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error analyzing query:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze query',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public suggestIndexes = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tableName } = req.params;
      
      if (!tableName) {
        res.status(400).json({
          success: false,
          error: 'Table name is required'
        });
        return;
      }

      const suggestions = await this.queryOptimizer.suggestIndexes(tableName);
      
      res.json({
        success: true,
        data: suggestions,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error suggesting indexes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to suggest indexes',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public benchmarkQuery = async (req: Request, res: Response): Promise<void> => {
    try {
      const { query, params, iterations = 5 } = req.body;
      
      if (!query) {
        res.status(400).json({
          success: false,
          error: 'Query is required'
        });
        return;
      }

      const benchmark = await this.queryOptimizer.benchmarkQuery(query, params, iterations);
      
      res.json({
        success: true,
        data: benchmark,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error benchmarking query:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to benchmark query',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public getQueryRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tableName } = req.query;
      
      const recommendations = await this.queryOptimizer.getQueryRecommendations(tableName as string);
      
      res.json({
        success: true,
        data: recommendations,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting query recommendations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get query recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  public getSystemHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const [
        connectionHealth,
        metrics,
        slowQueries,
        bloat
      ] = await Promise.all([
        this.performanceMonitor.getConnectionPoolHealth(),
        this.performanceMonitor.getComprehensiveMetrics(),
        this.performanceMonitor.getSlowQueries(5),
        this.performanceMonitor.getTableBloat()
      ]);

      const overallHealth = this.calculateOverallHealth(connectionHealth, metrics, slowQueries, bloat);
      
      res.json({
        success: true,
        data: {
          overallHealth,
          connectionPool: connectionHealth,
          performance: {
            cacheHitRatio: metrics.cachePerformance.hitRatio,
            avgQueryTime: metrics.queryPerformance.avgQueryTime,
            slowQueriesCount: slowQueries.length
          },
          issues: {
            bloatedTables: bloat.filter(table => table.bloatRatio > 20).length,
            slowQueries: slowQueries.length,
            connectionIssues: connectionHealth.status !== 'healthy'
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting system health:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system health',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  private calculateOverallHealth(
    connectionHealth: any,
    metrics: any,
    slowQueries: any[],
    bloat: any[]
  ): { status: 'healthy' | 'warning' | 'critical'; score: number; issues: string[] } {
    let score = 100;
    const issues: string[] = [];

    // Connection pool health
    if (connectionHealth.status === 'critical') {
      score -= 30;
      issues.push('Critical connection pool issues');
    } else if (connectionHealth.status === 'warning') {
      score -= 15;
      issues.push('Connection pool warnings');
    }

    // Cache performance
    if (metrics.cachePerformance.hitRatio < 90) {
      score -= 20;
      issues.push('Low cache hit ratio');
    } else if (metrics.cachePerformance.hitRatio < 95) {
      score -= 10;
      issues.push('Suboptimal cache performance');
    }

    // Query performance
    if (metrics.queryPerformance.avgQueryTime > 500) {
      score -= 25;
      issues.push('High average query time');
    } else if (metrics.queryPerformance.avgQueryTime > 200) {
      score -= 10;
      issues.push('Elevated query times');
    }

    // Slow queries
    if (slowQueries.length > 5) {
      score -= 15;
      issues.push('Multiple slow queries detected');
    } else if (slowQueries.length > 0) {
      score -= 5;
      issues.push('Some slow queries detected');
    }

    // Table bloat
    const bloatedTables = bloat.filter(table => table.bloatRatio > 20);
    if (bloatedTables.length > 2) {
      score -= 15;
      issues.push('Multiple bloated tables');
    } else if (bloatedTables.length > 0) {
      score -= 5;
      issues.push('Some table bloat detected');
    }

    let status: 'healthy' | 'warning' | 'critical';
    if (score >= 80) {
      status = 'healthy';
    } else if (score >= 60) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return { status, score, issues };
  }
}

export default PerformanceController;