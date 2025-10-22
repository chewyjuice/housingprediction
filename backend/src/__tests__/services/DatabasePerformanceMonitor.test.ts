import { DatabaseConnection } from '../../database/connection';
import { DatabasePerformanceMonitor } from '../../services/DatabasePerformanceMonitor';

// Mock the database connection
jest.mock('../../database/connection');

describe('DatabasePerformanceMonitor', () => {
  let mockDb: jest.Mocked<DatabaseConnection>;
  let monitor: DatabasePerformanceMonitor;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      getPoolInfo: jest.fn(),
      getPerformanceMetrics: jest.fn(),
    } as any;

    monitor = new DatabasePerformanceMonitor(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getComprehensiveMetrics', () => {
    it('should return comprehensive performance metrics', async () => {
      // Mock pool info
      mockDb.getPoolInfo.mockReturnValue({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
        maxConnections: 25,
        minConnections: 5
      });

      // Mock performance metrics
      mockDb.getPerformanceMetrics.mockResolvedValue({
        activeConnections: 5,
        totalQueries: 1000,
        slowQueries: 2,
        avgQueryTime: 150,
        cacheHitRatio: 95.5,
        indexUsage: []
      });

      // Mock database queries
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ buffer_cache_size: '128MB', shared_buffers: '256MB' }] })
        .mockResolvedValueOnce({ rows: [] }) // index usage
        .mockResolvedValueOnce({ rows: [] }) // table metrics - size
        .mockResolvedValueOnce({ rows: [] }) // table metrics - activity
        .mockResolvedValueOnce({ rows: [] }); // unused indexes

      const metrics = await monitor.getComprehensiveMetrics();

      expect(metrics).toHaveProperty('connectionPool');
      expect(metrics).toHaveProperty('queryPerformance');
      expect(metrics).toHaveProperty('cachePerformance');
      expect(metrics).toHaveProperty('indexUsage');
      expect(metrics).toHaveProperty('tableStats');
      expect(metrics).toHaveProperty('recommendations');

      expect(metrics.connectionPool.utilization).toBe(40); // 10/25 * 100
      expect(metrics.queryPerformance.totalQueries).toBe(1000);
      expect(metrics.cachePerformance.hitRatio).toBe(95.5);
    });

    it('should handle database query errors gracefully', async () => {
      mockDb.getPoolInfo.mockReturnValue({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
        maxConnections: 25,
        minConnections: 5
      });

      mockDb.getPerformanceMetrics.mockResolvedValue({
        activeConnections: 5,
        totalQueries: 1000,
        slowQueries: 2,
        avgQueryTime: 150,
        cacheHitRatio: 95.5,
        indexUsage: []
      });

      // Mock database query failure
      mockDb.query.mockRejectedValue(new Error('Database error'));

      const metrics = await monitor.getComprehensiveMetrics();

      expect(metrics).toHaveProperty('connectionPool');
      expect(metrics.recommendations).toContain('Database performance looks good - no immediate optimizations needed');
    });
  });

  describe('getConnectionPoolHealth', () => {
    it('should return healthy status for normal utilization', async () => {
      mockDb.getPoolInfo.mockReturnValue({
        totalCount: 15,
        idleCount: 10,
        waitingCount: 0,
        maxConnections: 25,
        minConnections: 5
      });

      const health = await monitor.getConnectionPoolHealth();

      expect(health.status).toBe('healthy');
      expect(health.details.utilization).toBe(60); // 15/25 * 100
      expect(health.recommendations).toHaveLength(0);
    });

    it('should return warning status for high utilization', async () => {
      mockDb.getPoolInfo.mockReturnValue({
        totalCount: 20,
        idleCount: 2,
        waitingCount: 0,
        maxConnections: 25,
        minConnections: 5
      });

      const health = await monitor.getConnectionPoolHealth();

      expect(health.status).toBe('warning');
      expect(health.details.utilization).toBe(80); // 20/25 * 100
      expect(health.recommendations).toContain('Consider increasing connection pool size');
    });

    it('should return critical status for very high utilization', async () => {
      mockDb.getPoolInfo.mockReturnValue({
        totalCount: 24,
        idleCount: 1,
        waitingCount: 2,
        maxConnections: 25,
        minConnections: 5
      });

      const health = await monitor.getConnectionPoolHealth();

      expect(health.status).toBe('critical');
      expect(health.details.utilization).toBe(96); // 24/25 * 100
      expect(health.recommendations).toContain('Increase connection pool size immediately');
      expect(health.recommendations).toContain('Connections are waiting - optimize query performance');
    });
  });

  describe('getSlowQueries', () => {
    it('should return slow queries when available', async () => {
      const mockSlowQueries = [
        {
          query: 'SELECT * FROM large_table WHERE condition = ?',
          calls: '100',
          total_time: '5000',
          avg_time: '50',
          rows: '1000'
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockSlowQueries });

      const slowQueries = await monitor.getSlowQueries(10);

      expect(slowQueries).toHaveLength(1);
      expect(slowQueries[0].avgTime).toBe(50);
      expect(slowQueries[0].calls).toBe(100);
    });

    it('should handle pg_stat_statements not available', async () => {
      mockDb.query.mockRejectedValue(new Error('relation "pg_stat_statements" does not exist'));

      const slowQueries = await monitor.getSlowQueries(10);

      expect(slowQueries).toEqual([]);
    });
  });

  describe('optimizeDatabase', () => {
    it('should perform optimization actions successfully', async () => {
      // Mock successful optimization queries
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // refresh materialized views
        .mockResolvedValueOnce({ rows: [] }); // analyze tables

      const result = await monitor.optimizeDatabase();

      expect(result.actions).toContain('Refresh materialized views');
      expect(result.actions).toContain('Update table statistics');
      expect(result.results.some(r => r.success)).toBe(true);
    });

    it('should handle optimization failures gracefully', async () => {
      // Mock failed optimization
      mockDb.query.mockRejectedValue(new Error('Optimization failed'));

      const result = await monitor.optimizeDatabase();

      expect(result.results.some(r => !r.success)).toBe(true);
      expect(result.results.some(r => r.message.includes('Failed'))).toBe(true);
    });
  });

  describe('runPerformanceAnalysis', () => {
    it('should identify critical issues', async () => {
      mockDb.getPoolInfo.mockReturnValue({
        totalCount: 24,
        idleCount: 1,
        waitingCount: 0,
        maxConnections: 25,
        minConnections: 5
      });

      mockDb.getPerformanceMetrics.mockResolvedValue({
        activeConnections: 23,
        totalQueries: 1000,
        slowQueries: 5,
        avgQueryTime: 600, // High query time
        cacheHitRatio: 85, // Low cache hit ratio
        indexUsage: []
      });

      mockDb.query.mockResolvedValue({ rows: [] });

      const analysis = await monitor.runPerformanceAnalysis();

      expect(analysis.criticalIssues).toContain('CRITICAL: Connection pool utilization is above 90%');
      expect(analysis.criticalIssues).toContain('CRITICAL: Cache hit ratio is below 90%');
      expect(analysis.criticalIssues).toContain('CRITICAL: Average query time is above 500ms');
      expect(analysis.summary).toContain('critical issues found');
    });

    it('should report good performance when no issues', async () => {
      mockDb.getPoolInfo.mockReturnValue({
        totalCount: 10,
        idleCount: 5,
        waitingCount: 0,
        maxConnections: 25,
        minConnections: 5
      });

      mockDb.getPerformanceMetrics.mockResolvedValue({
        activeConnections: 5,
        totalQueries: 1000,
        slowQueries: 0,
        avgQueryTime: 50,
        cacheHitRatio: 98,
        indexUsage: []
      });

      mockDb.query.mockResolvedValue({ rows: [] });

      const analysis = await monitor.runPerformanceAnalysis();

      expect(analysis.criticalIssues).toHaveLength(0);
      expect(analysis.summary).toContain('System is performing well');
    });
  });
});