import { RedisClientType } from 'redis';
import { redisConnection } from '../database/redis';
import { Area, PredictionResult, Development } from '../types';

export class CacheService {
  private client: RedisClientType | null = null;

  constructor() {
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      this.client = await redisConnection.connect();
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
    }
  }

  private async ensureClient(): Promise<RedisClientType> {
    if (!this.client || !redisConnection.isClientConnected()) {
      this.client = await redisConnection.connect();
    }
    return this.client;
  }

  // Cache keys
  private getAreaKey(areaId: string): string {
    return `area:${areaId}`;
  }

  private getAreaSearchKey(query: string): string {
    return `area_search:${query.toLowerCase().replace(/\s+/g, '_')}`;
  }

  private getPredictionKey(requestId: string): string {
    return `prediction:${requestId}`;
  }

  private getAreaPredictionsKey(areaId: string): string {
    return `area_predictions:${areaId}`;
  }

  private getDevelopmentsKey(areaId: string): string {
    return `developments:${areaId}`;
  }

  // Area caching methods
  async cacheArea(area: Area, ttl: number = 3600): Promise<void> {
    try {
      const client = await this.ensureClient();
      const key = this.getAreaKey(area.id);
      await client.setEx(key, ttl, JSON.stringify(area));
    } catch (error) {
      console.error('Error caching area:', error);
    }
  }

  async getCachedArea(areaId: string): Promise<Area | null> {
    try {
      const client = await this.ensureClient();
      const key = this.getAreaKey(areaId);
      const cached = await client.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting cached area:', error);
      return null;
    }
  }

  async cacheAreaSearch(query: string, areas: Area[], ttl: number = 1800): Promise<void> {
    try {
      const client = await this.ensureClient();
      const key = this.getAreaSearchKey(query);
      await client.setEx(key, ttl, JSON.stringify(areas));
    } catch (error) {
      console.error('Error caching area search:', error);
    }
  }

  async getCachedAreaSearch(query: string): Promise<Area[] | null> {
    try {
      const client = await this.ensureClient();
      const key = this.getAreaSearchKey(query);
      const cached = await client.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting cached area search:', error);
      return null;
    }
  }

  // Prediction result caching methods
  async cachePredictionResult(result: PredictionResult, ttl: number = 7200): Promise<void> {
    try {
      const client = await this.ensureClient();
      const key = this.getPredictionKey(result.requestId);
      
      // Cache the individual prediction result
      await client.setEx(key, ttl, JSON.stringify(result));
      
      // Add to area predictions set for easy retrieval
      const areaKey = this.getAreaPredictionsKey(result.requestId.split('_')[0]); // Assuming requestId format includes areaId
      await client.sAdd(areaKey, result.requestId);
      await client.expire(areaKey, ttl);
    } catch (error) {
      console.error('Error caching prediction result:', error);
    }
  }

  async getCachedPredictionResult(requestId: string): Promise<PredictionResult | null> {
    try {
      const client = await this.ensureClient();
      const key = this.getPredictionKey(requestId);
      const cached = await client.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting cached prediction result:', error);
      return null;
    }
  }

  async getCachedAreaPredictions(areaId: string): Promise<PredictionResult[]> {
    try {
      const client = await this.ensureClient();
      const areaKey = this.getAreaPredictionsKey(areaId);
      const requestIds = await client.sMembers(areaKey);
      
      const predictions: PredictionResult[] = [];
      for (const requestId of requestIds) {
        const prediction = await this.getCachedPredictionResult(requestId);
        if (prediction) {
          predictions.push(prediction);
        }
      }
      
      return predictions;
    } catch (error) {
      console.error('Error getting cached area predictions:', error);
      return [];
    }
  }

  // Development data caching methods
  async cacheDevelopments(areaId: string, developments: Development[], ttl: number = 3600): Promise<void> {
    try {
      const client = await this.ensureClient();
      const key = this.getDevelopmentsKey(areaId);
      await client.setEx(key, ttl, JSON.stringify(developments));
    } catch (error) {
      console.error('Error caching developments:', error);
    }
  }

  async getCachedDevelopments(areaId: string): Promise<Development[] | null> {
    try {
      const client = await this.ensureClient();
      const key = this.getDevelopmentsKey(areaId);
      const cached = await client.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting cached developments:', error);
      return null;
    }
  }

  // Cache invalidation methods
  async invalidateAreaCache(areaId: string): Promise<void> {
    try {
      const client = await this.ensureClient();
      
      // Remove area data
      await client.del(this.getAreaKey(areaId));
      
      // Remove area predictions
      const areaKey = this.getAreaPredictionsKey(areaId);
      const requestIds = await client.sMembers(areaKey);
      
      // Remove individual prediction results
      for (const requestId of requestIds) {
        await client.del(this.getPredictionKey(requestId));
      }
      await client.del(areaKey);
      
      // Remove developments
      await client.del(this.getDevelopmentsKey(areaId));
      
      console.log(`Cache invalidated for area: ${areaId}`);
    } catch (error) {
      console.error('Error invalidating area cache:', error);
    }
  }

  async invalidateAreaSearchCache(): Promise<void> {
    try {
      const client = await this.ensureClient();
      const keys = await client.keys('area_search:*');
      if (keys.length > 0) {
        await client.del(keys);
      }
      console.log('Area search cache invalidated');
    } catch (error) {
      console.error('Error invalidating area search cache:', error);
    }
  }

  async invalidateDevelopmentCache(areaId: string): Promise<void> {
    try {
      const client = await this.ensureClient();
      await client.del(this.getDevelopmentsKey(areaId));
      
      // Also invalidate related predictions since development data affects predictions
      await this.invalidateAreaPredictions(areaId);
      
      console.log(`Development cache invalidated for area: ${areaId}`);
    } catch (error) {
      console.error('Error invalidating development cache:', error);
    }
  }

  async invalidateAreaPredictions(areaId: string): Promise<void> {
    try {
      const client = await this.ensureClient();
      const areaKey = this.getAreaPredictionsKey(areaId);
      const requestIds = await client.sMembers(areaKey);
      
      // Remove individual prediction results
      for (const requestId of requestIds) {
        await client.del(this.getPredictionKey(requestId));
      }
      await client.del(areaKey);
      
      console.log(`Prediction cache invalidated for area: ${areaId}`);
    } catch (error) {
      console.error('Error invalidating area predictions:', error);
    }
  }

  // Cache statistics and monitoring
  async getCacheStats(): Promise<{
    totalKeys: number;
    areaKeys: number;
    predictionKeys: number;
    developmentKeys: number;
    searchKeys: number;
  }> {
    try {
      const client = await this.ensureClient();
      
      const [
        totalKeys,
        areaKeys,
        predictionKeys,
        developmentKeys,
        searchKeys
      ] = await Promise.all([
        client.dbSize(),
        client.keys('area:*').then(keys => keys.length),
        client.keys('prediction:*').then(keys => keys.length),
        client.keys('developments:*').then(keys => keys.length),
        client.keys('area_search:*').then(keys => keys.length)
      ]);

      return {
        totalKeys,
        areaKeys,
        predictionKeys,
        developmentKeys,
        searchKeys
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalKeys: 0,
        areaKeys: 0,
        predictionKeys: 0,
        developmentKeys: 0,
        searchKeys: 0
      };
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      const result = await client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    try {
      await redisConnection.disconnect();
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }
}

export default CacheService;