import { DatabaseConnection } from '../database/connection';

export interface QueryOptimizationOptions {
  useIndex?: string;
  forceIndexScan?: boolean;
  enableParallelQuery?: boolean;
  workMem?: string;
  enableHashJoin?: boolean;
  enableMergeJoin?: boolean;
  enableNestedLoop?: boolean;
}

export interface QueryPlan {
  nodeType: string;
  totalCost: number;
  planRows: number;
  planWidth: number;
  actualTime: number;
  actualRows: number;
  actualLoops: number;
  buffers?: {
    shared: {
      hit: number;
      read: number;
      dirtied: number;
      written: number;
    };
  };
}

export interface QueryAnalysis {
  executionTime: number;
  planningTime: number;
  totalTime: number;
  plan: QueryPlan;
  bufferUsage: {
    sharedHit: number;
    sharedRead: number;
    sharedDirtied: number;
    sharedWritten: number;
  };
  recommendations: string[];
}

export class QueryOptimizer {
  constructor(private db: DatabaseConnection) {}

  async optimizeQuery(
    query: string,
    params?: any[],
    options?: QueryOptimizationOptions
  ): Promise<string> {
    let optimizedQuery = query;
    const sessionSettings: string[] = [];

    // Apply optimization options
    if (options?.workMem) {
      sessionSettings.push(`SET work_mem = '${options.workMem}'`);
    }

    if (options?.enableParallelQuery === false) {
      sessionSettings.push('SET max_parallel_workers_per_gather = 0');
    }

    if (options?.forceIndexScan) {
      sessionSettings.push('SET enable_seqscan = off');
    }

    if (options?.enableHashJoin === false) {
      sessionSettings.push('SET enable_hashjoin = off');
    }

    if (options?.enableMergeJoin === false) {
      sessionSettings.push('SET enable_mergejoin = off');
    }

    if (options?.enableNestedLoop === false) {
      sessionSettings.push('SET enable_nestloop = off');
    }

    if (options?.useIndex) {
      // Add index hint as comment for documentation
      optimizedQuery = `/* USE INDEX ${options.useIndex} */ ${optimizedQuery}`;
    }

    // Combine session settings with query
    if (sessionSettings.length > 0) {
      const resetSettings = sessionSettings.map(setting => 
        setting.replace('SET ', 'RESET ').replace(/ = .*/, '')
      );
      
      optimizedQuery = `
        ${sessionSettings.join('; ')};
        ${optimizedQuery};
        ${resetSettings.join('; ')};
      `;
    }

    return optimizedQuery;
  }

  async analyzeQuery(query: string, params?: any[]): Promise<QueryAnalysis> {
    const explainQuery = `
      EXPLAIN (
        ANALYZE true,
        VERBOSE true,
        COSTS true,
        BUFFERS true,
        TIMING true,
        SUMMARY true,
        FORMAT JSON
      ) ${query}
    `;

    const start = Date.now();
    const result = await this.db.query(explainQuery, params);
    const totalTime = Date.now() - start;

    const planData = result.rows[0]['QUERY PLAN'][0];
    const plan = planData.Plan;
    const executionTime = planData['Execution Time'] || 0;
    const planningTime = planData['Planning Time'] || 0;

    // Extract buffer usage
    const bufferUsage = this.extractBufferUsage(plan);
    
    // Generate recommendations
    const recommendations = this.generateQueryRecommendations(plan, executionTime, bufferUsage);

    return {
      executionTime,
      planningTime,
      totalTime,
      plan: {
        nodeType: plan['Node Type'],
        totalCost: plan['Total Cost'],
        planRows: plan['Plan Rows'],
        planWidth: plan['Plan Width'],
        actualTime: plan['Actual Total Time'],
        actualRows: plan['Actual Rows'],
        actualLoops: plan['Actual Loops'],
        buffers: plan.Buffers
      },
      bufferUsage,
      recommendations
    };
  }

  private extractBufferUsage(plan: any): {
    sharedHit: number;
    sharedRead: number;
    sharedDirtied: number;
    sharedWritten: number;
  } {
    let bufferUsage = {
      sharedHit: 0,
      sharedRead: 0,
      sharedDirtied: 0,
      sharedWritten: 0
    };

    const extractFromNode = (node: any) => {
      if (node.Buffers) {
        bufferUsage.sharedHit += node.Buffers['Shared Hit Blocks'] || 0;
        bufferUsage.sharedRead += node.Buffers['Shared Read Blocks'] || 0;
        bufferUsage.sharedDirtied += node.Buffers['Shared Dirtied Blocks'] || 0;
        bufferUsage.sharedWritten += node.Buffers['Shared Written Blocks'] || 0;
      }

      if (node.Plans) {
        node.Plans.forEach(extractFromNode);
      }
    };

    extractFromNode(plan);
    return bufferUsage;
  }

  private generateQueryRecommendations(
    plan: any, 
    executionTime: number, 
    bufferUsage: any
  ): string[] {
    const recommendations: string[] = [];

    // Check for sequential scans on large tables
    this.checkForSeqScans(plan, recommendations);

    // Check for expensive operations
    if (executionTime > 1000) {
      recommendations.push('Query execution time is high (>1s) - consider optimization');
    }

    // Check buffer usage
    if (bufferUsage.sharedRead > bufferUsage.sharedHit) {
      recommendations.push('High disk I/O detected - consider increasing shared_buffers or adding indexes');
    }

    // Check for expensive sorts
    this.checkForExpensiveSorts(plan, recommendations);

    // Check for nested loops with high cost
    this.checkForExpensiveNestedLoops(plan, recommendations);

    return recommendations;
  }

  private checkForSeqScans(node: any, recommendations: string[]) {
    if (node['Node Type'] === 'Seq Scan' && node['Plan Rows'] > 10000) {
      recommendations.push(`Sequential scan on ${node['Relation Name']} with ${node['Plan Rows']} rows - consider adding an index`);
    }

    if (node.Plans) {
      node.Plans.forEach((childNode: any) => this.checkForSeqScans(childNode, recommendations));
    }
  }

  private checkForExpensiveSorts(node: any, recommendations: string[]) {
    if (node['Node Type'] === 'Sort' && node['Total Cost'] > 1000) {
      recommendations.push('Expensive sort operation detected - consider adding an index for ORDER BY clause');
    }

    if (node.Plans) {
      node.Plans.forEach((childNode: any) => this.checkForExpensiveSorts(childNode, recommendations));
    }
  }

  private checkForExpensiveNestedLoops(node: any, recommendations: string[]) {
    if (node['Node Type'] === 'Nested Loop' && node['Actual Loops'] > 1000) {
      recommendations.push('High-cost nested loop detected - consider adding indexes on join columns');
    }

    if (node.Plans) {
      node.Plans.forEach((childNode: any) => this.checkForExpensiveNestedLoops(childNode, recommendations));
    }
  }

  async suggestIndexes(tableName: string): Promise<Array<{
    column: string;
    indexType: string;
    reason: string;
    estimatedBenefit: 'high' | 'medium' | 'low';
  }>> {
    const suggestions: Array<{
      column: string;
      indexType: string;
      reason: string;
      estimatedBenefit: 'high' | 'medium' | 'low';
    }> = [];

    try {
      // Analyze query patterns for the table
      const result = await this.db.query(`
        SELECT 
          query,
          calls,
          mean_exec_time
        FROM pg_stat_statements 
        WHERE query ILIKE '%${tableName}%'
          AND calls > 10
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `);

      // Simple heuristics for index suggestions
      for (const row of result.rows) {
        const query = row.query.toLowerCase();
        
        // Look for WHERE clauses
        if (query.includes('where') && query.includes('=')) {
          const whereMatch = query.match(/where\s+(\w+)\s*=/);
          if (whereMatch) {
            suggestions.push({
              column: whereMatch[1],
              indexType: 'btree',
              reason: 'Frequent equality comparisons in WHERE clause',
              estimatedBenefit: row.calls > 100 ? 'high' : 'medium'
            });
          }
        }

        // Look for ORDER BY clauses
        if (query.includes('order by')) {
          const orderMatch = query.match(/order\s+by\s+(\w+)/);
          if (orderMatch) {
            suggestions.push({
              column: orderMatch[1],
              indexType: 'btree',
              reason: 'Frequent sorting operations',
              estimatedBenefit: row.mean_exec_time > 100 ? 'high' : 'medium'
            });
          }
        }

        // Look for text search patterns
        if (query.includes('ilike') || query.includes('like')) {
          suggestions.push({
            column: 'text_columns',
            indexType: 'gin',
            reason: 'Text search patterns detected',
            estimatedBenefit: 'medium'
          });
        }
      }

      // Remove duplicates
      const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
        index === self.findIndex(s => s.column === suggestion.column && s.indexType === suggestion.indexType)
      );

      return uniqueSuggestions;
    } catch (error) {
      console.warn('Failed to suggest indexes:', error);
      return [];
    }
  }

  async benchmarkQuery(
    query: string,
    params?: any[],
    iterations: number = 5
  ): Promise<{
    avgExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    standardDeviation: number;
    executionTimes: number[];
  }> {
    const executionTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.db.query(query, params);
      const executionTime = Date.now() - start;
      executionTimes.push(executionTime);
    }

    const avgExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / iterations;
    const minExecutionTime = Math.min(...executionTimes);
    const maxExecutionTime = Math.max(...executionTimes);
    
    const variance = executionTimes.reduce((sum, time) => sum + Math.pow(time - avgExecutionTime, 2), 0) / iterations;
    const standardDeviation = Math.sqrt(variance);

    return {
      avgExecutionTime,
      minExecutionTime,
      maxExecutionTime,
      standardDeviation,
      executionTimes
    };
  }

  async getQueryRecommendations(tableName?: string): Promise<{
    indexRecommendations: Array<{
      table: string;
      column: string;
      indexType: string;
      reason: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    queryOptimizations: Array<{
      query: string;
      issue: string;
      recommendation: string;
      estimatedImprovement: string;
    }>;
  }> {
    const indexRecommendations: Array<{
      table: string;
      column: string;
      indexType: string;
      reason: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    const queryOptimizations: Array<{
      query: string;
      issue: string;
      recommendation: string;
      estimatedImprovement: string;
    }> = [];

    try {
      // Get slow queries
      const slowQueries = await this.db.query(`
        SELECT 
          query,
          calls,
          mean_exec_time,
          total_exec_time
        FROM pg_stat_statements 
        WHERE mean_exec_time > 100
          AND calls > 5
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `);

      for (const row of slowQueries.rows) {
        const query = row.query.substring(0, 100) + '...';
        
        if (row.mean_exec_time > 1000) {
          queryOptimizations.push({
            query,
            issue: 'Very slow execution time',
            recommendation: 'Analyze query plan and add appropriate indexes',
            estimatedImprovement: '50-80% faster'
          });
        } else if (row.mean_exec_time > 500) {
          queryOptimizations.push({
            query,
            issue: 'Moderate execution time',
            recommendation: 'Consider query optimization or index tuning',
            estimatedImprovement: '20-50% faster'
          });
        }
      }

      // Get tables without proper indexes
      const tablesWithoutIndexes = await this.db.query(`
        SELECT 
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          n_tup_ins + n_tup_upd + n_tup_del as modifications
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
          AND seq_scan > idx_scan
          AND seq_tup_read > 10000
        ORDER BY seq_tup_read DESC
      `);

      for (const row of tablesWithoutIndexes.rows) {
        indexRecommendations.push({
          table: row.tablename,
          column: 'frequently_queried_columns',
          indexType: 'btree',
          reason: `High sequential scan ratio (${row.seq_scan} seq scans vs ${row.idx_scan || 0} index scans)`,
          priority: row.seq_tup_read > 100000 ? 'high' : 'medium'
        });
      }

      return {
        indexRecommendations,
        queryOptimizations
      };
    } catch (error) {
      console.warn('Failed to get query recommendations:', error);
      return {
        indexRecommendations: [],
        queryOptimizations: []
      };
    }
  }
}

export default QueryOptimizer;