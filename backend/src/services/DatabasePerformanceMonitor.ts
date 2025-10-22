import { DatabaseConnection } from '../database/connection';

export interface DatabaseMetrics {
  connectionPool: {
    total: number;
    idle: number;
    waiting: number;
    active: number;
    utilization: number;
  };
  queryPerformance: {
    totalQueries: number;
    slowQueries: number;
    avgQueryTime: number;
    slowQueryThreshold: number;
  };
  cachePerformance: {
    hitRatio: number;
    bufferCacheSize: string;
    sharedBuffers: string;
  };
  indexUsage: {
    mostUsedIndexes: Array<{
      table: string;
      index: string;
      scans: number;
      tuplesRead: number;
      tuplesFetched: number;
    }>;
    unusedIndexes: Array<{
      table: string;
      index: string;
      size: string;
    }>;
  };
  tableStats: {
    largestTables: Array<{
      table: string;
      size: string;
      rowCount: number;
    }>;
    mostActiveTable: Array<{
      table: string;
      inserts: number;
      updates: number;
      deletes: number;
      selects: number;
    }>;
  };
  recommendations: string[];
}

export class DatabasePerformanceMonitor {
  constructor(private db: DatabaseConnection) {}

  async getComprehensiveMetrics(): Promise<DatabaseMetrics> {
    const [
      poolInfo,
      performanceMetrics,
      cacheMetrics,
      indexMetrics,
      tableMetrics,
      unusedIndexes
    ] = await Promise.all([
      this.getConnectionPoolMetrics(),
      this.db.getPerformanceMetrics(),
      this.getCacheMetrics(),
      this.getIndexUsageMetrics(),
      this.getTableMetrics(),
      this.getUnusedIndexes()
    ]);

    const recommendations = this.generateRecommendations({
      poolInfo,
      performanceMetrics,
      cacheMetrics,
      indexMetrics,
      tableMetrics,
      unusedIndexes
    });

    return {
      connectionPool: {
        total: poolInfo.totalCount,
        idle: poolInfo.idleCount,
        waiting: poolInfo.waitingCount,
        active: poolInfo.totalCount - poolInfo.idleCount,
        utilization: ((poolInfo.totalCount - poolInfo.idleCount) / poolInfo.maxConnections) * 100
      },
      queryPerformance: {
        totalQueries: performanceMetrics.totalQueries,
        slowQueries: performanceMetrics.slowQueries,
        avgQueryTime: performanceMetrics.avgQueryTime,
        slowQueryThreshold: 1000 // 1 second
      },
      cachePerformance: {
        hitRatio: performanceMetrics.cacheHitRatio,
        bufferCacheSize: cacheMetrics.bufferCacheSize,
        sharedBuffers: cacheMetrics.sharedBuffers
      },
      indexUsage: {
        mostUsedIndexes: indexMetrics.slice(0, 10),
        unusedIndexes: unusedIndexes
      },
      tableStats: {
        largestTables: tableMetrics.largestTables,
        mostActiveTable: tableMetrics.mostActive
      },
      recommendations
    };
  }

  private async getConnectionPoolMetrics() {
    return this.db.getPoolInfo();
  }

  private async getCacheMetrics(): Promise<{
    bufferCacheSize: string;
    sharedBuffers: string;
  }> {
    try {
      const result = await this.db.query(`
        SELECT 
          pg_size_pretty(
            CAST(current_setting('shared_buffers') AS bigint) * 8192
          ) as shared_buffers,
          pg_size_pretty(
            sum(heap_blks_hit + heap_blks_read) * 8192
          ) as buffer_cache_size
        FROM pg_statio_user_tables
      `);

      return {
        bufferCacheSize: result.rows[0]?.buffer_cache_size || '0 bytes',
        sharedBuffers: result.rows[0]?.shared_buffers || '0 bytes'
      };
    } catch (error) {
      console.warn('Failed to get cache metrics:', error);
      return {
        bufferCacheSize: 'unknown',
        sharedBuffers: 'unknown'
      };
    }
  }

  private async getIndexUsageMetrics(): Promise<Array<{
    table: string;
    index: string;
    scans: number;
    tuplesRead: number;
    tuplesFetched: number;
  }>> {
    try {
      const result = await this.db.query(`
        SELECT 
          schemaname || '.' || tablename as table,
          indexname as index,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC 
        LIMIT 20
      `);

      return result.rows.map(row => ({
        table: row.table,
        index: row.index,
        scans: parseInt(row.scans || '0'),
        tuplesRead: parseInt(row.tuples_read || '0'),
        tuplesFetched: parseInt(row.tuples_fetched || '0')
      }));
    } catch (error) {
      console.warn('Failed to get index usage metrics:', error);
      return [];
    }
  }

  private async getUnusedIndexes(): Promise<Array<{
    table: string;
    index: string;
    size: string;
  }>> {
    try {
      const result = await this.db.query(`
        SELECT 
          schemaname || '.' || tablename as table,
          indexname as index,
          pg_size_pretty(pg_relation_size(indexrelid)) as size
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
          AND idx_scan = 0
          AND indexname NOT LIKE '%_pkey'
        ORDER BY pg_relation_size(indexrelid) DESC
      `);

      return result.rows.map(row => ({
        table: row.table,
        index: row.index,
        size: row.size
      }));
    } catch (error) {
      console.warn('Failed to get unused indexes:', error);
      return [];
    }
  }

  private async getTableMetrics(): Promise<{
    largestTables: Array<{
      table: string;
      size: string;
      rowCount: number;
    }>;
    mostActive: Array<{
      table: string;
      inserts: number;
      updates: number;
      deletes: number;
      selects: number;
    }>;
  }> {
    try {
      const [sizeResult, activityResult] = await Promise.all([
        this.db.query(`
          SELECT 
            schemaname || '.' || tablename as table,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            n_tup_ins + n_tup_upd + n_tup_del as row_count
          FROM pg_stat_user_tables 
          WHERE schemaname = 'public'
          ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
          LIMIT 10
        `),
        this.db.query(`
          SELECT 
            schemaname || '.' || tablename as table,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes,
            seq_scan + idx_scan as selects
          FROM pg_stat_user_tables 
          WHERE schemaname = 'public'
          ORDER BY (n_tup_ins + n_tup_upd + n_tup_del + seq_scan + idx_scan) DESC 
          LIMIT 10
        `)
      ]);

      return {
        largestTables: sizeResult.rows.map(row => ({
          table: row.table,
          size: row.size,
          rowCount: parseInt(row.row_count || '0')
        })),
        mostActive: activityResult.rows.map(row => ({
          table: row.table,
          inserts: parseInt(row.inserts || '0'),
          updates: parseInt(row.updates || '0'),
          deletes: parseInt(row.deletes || '0'),
          selects: parseInt(row.selects || '0')
        }))
      };
    } catch (error) {
      console.warn('Failed to get table metrics:', error);
      return {
        largestTables: [],
        mostActive: []
      };
    }
  }

  private generateRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];

    // Connection pool recommendations
    if (metrics.poolInfo.utilization > 80) {
      recommendations.push('Consider increasing the connection pool size - current utilization is high');
    }

    if (metrics.poolInfo.waitingCount > 0) {
      recommendations.push('Connections are waiting - consider optimizing query performance or increasing pool size');
    }

    // Cache recommendations
    if (metrics.performanceMetrics.cacheHitRatio < 95) {
      recommendations.push('Cache hit ratio is below 95% - consider increasing shared_buffers or optimizing queries');
    }

    // Query performance recommendations
    if (metrics.performanceMetrics.slowQueries > 0) {
      recommendations.push(`${metrics.performanceMetrics.slowQueries} slow queries detected - review and optimize these queries`);
    }

    if (metrics.performanceMetrics.avgQueryTime > 100) {
      recommendations.push('Average query time is high - consider adding indexes or optimizing queries');
    }

    // Index recommendations
    if (metrics.unusedIndexes.length > 0) {
      recommendations.push(`${metrics.unusedIndexes.length} unused indexes found - consider dropping them to improve write performance`);
    }

    // Table recommendations
    const largestTable = metrics.tableMetrics.largestTables[0];
    if (largestTable && largestTable.rowCount > 1000000) {
      recommendations.push(`Table ${largestTable.table} has over 1M rows - consider partitioning or archiving old data`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Database performance looks good - no immediate optimizations needed');
    }

    return recommendations;
  }

  async runPerformanceAnalysis(): Promise<{
    summary: string;
    metrics: DatabaseMetrics;
    criticalIssues: string[];
  }> {
    const metrics = await this.getComprehensiveMetrics();
    const criticalIssues: string[] = [];

    // Identify critical issues
    if (metrics.connectionPool.utilization > 90) {
      criticalIssues.push('CRITICAL: Connection pool utilization is above 90%');
    }

    if (metrics.cachePerformance.hitRatio < 90) {
      criticalIssues.push('CRITICAL: Cache hit ratio is below 90%');
    }

    if (metrics.queryPerformance.avgQueryTime > 500) {
      criticalIssues.push('CRITICAL: Average query time is above 500ms');
    }

    const summary = criticalIssues.length > 0 
      ? `Performance analysis complete. ${criticalIssues.length} critical issues found.`
      : 'Performance analysis complete. System is performing well.';

    return {
      summary,
      metrics,
      criticalIssues
    };
  }

  // Advanced monitoring methods
  async getSlowQueries(limit: number = 10): Promise<Array<{
    query: string;
    calls: number;
    totalTime: number;
    avgTime: number;
    rows: number;
  }>> {
    try {
      const result = await this.db.query(`
        SELECT 
          query,
          calls,
          total_exec_time as total_time,
          mean_exec_time as avg_time,
          rows
        FROM pg_stat_statements 
        WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
        ORDER BY mean_exec_time DESC 
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        query: row.query.substring(0, 200) + '...',
        calls: parseInt(row.calls || '0'),
        totalTime: parseFloat(row.total_time || '0'),
        avgTime: parseFloat(row.avg_time || '0'),
        rows: parseInt(row.rows || '0')
      }));
    } catch (error) {
      console.warn('Failed to get slow queries:', error);
      return [];
    }
  }

  async getIndexEfficiency(): Promise<Array<{
    table: string;
    index: string;
    scans: number;
    tuplesRead: number;
    efficiency: number;
    size: string;
  }>> {
    try {
      const result = await this.db.query(`
        SELECT 
          schemaname || '.' || tablename as table,
          indexname as index,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          CASE 
            WHEN idx_scan = 0 THEN 0
            ELSE ROUND((idx_tup_fetch::numeric / idx_tup_read::numeric) * 100, 2)
          END as efficiency,
          pg_size_pretty(pg_relation_size(indexrelid)) as size
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
          AND idx_scan > 0
        ORDER BY efficiency DESC, idx_scan DESC
        LIMIT 20
      `);

      return result.rows.map(row => ({
        table: row.table,
        index: row.index,
        scans: parseInt(row.scans || '0'),
        tuplesRead: parseInt(row.tuples_read || '0'),
        efficiency: parseFloat(row.efficiency || '0'),
        size: row.size
      }));
    } catch (error) {
      console.warn('Failed to get index efficiency:', error);
      return [];
    }
  }

  async getTableBloat(): Promise<Array<{
    table: string;
    size: string;
    bloatRatio: number;
    wastedSpace: string;
  }>> {
    try {
      const result = await this.db.query(`
        SELECT 
          schemaname || '.' || tablename as table,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          ROUND(
            (n_dead_tup::numeric / GREATEST(n_live_tup + n_dead_tup, 1)::numeric) * 100, 2
          ) as bloat_ratio,
          pg_size_pretty(
            pg_total_relation_size(schemaname||'.'||tablename) * 
            (n_dead_tup::numeric / GREATEST(n_live_tup + n_dead_tup, 1)::numeric)
          ) as wasted_space
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
          AND n_dead_tup > 0
        ORDER BY bloat_ratio DESC
        LIMIT 10
      `);

      return result.rows.map(row => ({
        table: row.table,
        size: row.size,
        bloatRatio: parseFloat(row.bloat_ratio || '0'),
        wastedSpace: row.wasted_space
      }));
    } catch (error) {
      console.warn('Failed to get table bloat:', error);
      return [];
    }
  }

  async optimizeDatabase(): Promise<{
    actions: string[];
    results: Array<{
      action: string;
      success: boolean;
      message: string;
    }>;
  }> {
    const actions = [
      'Refresh materialized views',
      'Update table statistics',
      'Reindex heavily used indexes',
      'Vacuum analyze tables'
    ];

    const results: Array<{
      action: string;
      success: boolean;
      message: string;
    }> = [];

    // Refresh materialized views
    try {
      await this.db.query('SELECT refresh_area_statistics()');
      results.push({
        action: 'Refresh materialized views',
        success: true,
        message: 'Area statistics materialized view refreshed successfully'
      });
    } catch (error) {
      results.push({
        action: 'Refresh materialized views',
        success: false,
        message: `Failed to refresh materialized views: ${error instanceof Error ? error.message : error}`
      });
    }

    // Update table statistics
    try {
      await this.db.query(`
        ANALYZE areas;
        ANALYZE developments;
        ANALYZE prediction_requests;
        ANALYZE prediction_results;
        ANALYZE historical_prices;
      `);
      results.push({
        action: 'Update table statistics',
        success: true,
        message: 'Table statistics updated successfully'
      });
    } catch (error) {
      results.push({
        action: 'Update table statistics',
        success: false,
        message: `Failed to update statistics: ${error instanceof Error ? error.message : error}`
      });
    }

    // Vacuum analyze tables with high bloat
    const bloatedTables = await this.getTableBloat();
    for (const table of bloatedTables.slice(0, 3)) { // Only top 3 most bloated
      if (table.bloatRatio > 20) {
        try {
          await this.db.query(`VACUUM ANALYZE ${table.table.split('.')[1]}`);
          results.push({
            action: `Vacuum ${table.table}`,
            success: true,
            message: `Vacuumed table ${table.table} (${table.bloatRatio}% bloat)`
          });
        } catch (error) {
          results.push({
            action: `Vacuum ${table.table}`,
            success: false,
            message: `Failed to vacuum ${table.table}: ${error instanceof Error ? error.message : error}`
          });
        }
      }
    }

    return { actions, results };
  }

  async getConnectionPoolHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    details: {
      totalConnections: number;
      activeConnections: number;
      idleConnections: number;
      waitingConnections: number;
      utilization: number;
      maxConnections: number;
    };
    recommendations: string[];
  }> {
    const poolInfo = this.db.getPoolInfo();
    const utilization = (poolInfo.totalCount / poolInfo.maxConnections) * 100;
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];

    if (utilization > 90) {
      status = 'critical';
      recommendations.push('Increase connection pool size immediately');
      recommendations.push('Review long-running queries');
    } else if (utilization > 70) {
      status = 'warning';
      recommendations.push('Consider increasing connection pool size');
      recommendations.push('Monitor query performance');
    }

    if (poolInfo.waitingCount > 0) {
      status = status === 'critical' ? 'critical' : 'warning';
      recommendations.push('Connections are waiting - optimize query performance');
    }

    return {
      status,
      details: {
        totalConnections: poolInfo.totalCount,
        activeConnections: poolInfo.totalCount - poolInfo.idleCount,
        idleConnections: poolInfo.idleCount,
        waitingConnections: poolInfo.waitingCount,
        utilization,
        maxConnections: poolInfo.maxConnections
      },
      recommendations
    };
  }
}

export default DatabasePerformanceMonitor;