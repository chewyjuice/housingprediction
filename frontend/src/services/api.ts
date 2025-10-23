import { 
  ApiResponse, 
  Area, 
  CreatePredictionRequest, 
  PredictionResult, 
  PredictionHistoryQuery,
  AreaSearchQuery,
  AreaValidationRequest,
  AccuracyMetrics
} from '../types';

class ApiService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    this.timeout = 30000; // 30 seconds
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        console.log(`[API] HTTP Error ${response.status}: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        throw error;
      }
      
      throw new Error('Unknown error occurred');
    }
  }

  // Health check
  async checkHealth(): Promise<ApiResponse<any>> {
    return this.request('/api/health');
  }

  // Area-related API calls
  async searchAreas(query: AreaSearchQuery): Promise<ApiResponse<Area[]>> {
    const params = new URLSearchParams();
    if (query.query) params.append('query', query.query);
    if (query.district) params.append('district', query.district);
    if (query.postalCode) params.append('postalCode', query.postalCode);
    
    return this.request(`/api/areas/search?${params.toString()}`);
  }

  async validateCoordinates(request: AreaValidationRequest): Promise<ApiResponse<Area>> {
    return this.request('/api/areas/validate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getAreaById(areaId: string): Promise<ApiResponse<Area>> {
    return this.request(`/api/areas/${areaId}`);
  }

  async getDistricts(): Promise<ApiResponse<string[]>> {
    return this.request('/api/areas/districts');
  }

  async getNearbyAreas(lat: number, lng: number, radius?: number): Promise<ApiResponse<Area[]>> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    });
    if (radius) params.append('radius', radius.toString());
    
    return this.request(`/api/areas/nearby?${params.toString()}`);
  }

  // Prediction-related API calls
  async createPredictionRequest(request: CreatePredictionRequest): Promise<ApiResponse<{ requestId: string; status: string }>> {
    return this.request('/api/predictions/request', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getPredictionResult(requestId: string): Promise<ApiResponse<PredictionResult>> {
    return this.request(`/api/predictions/${requestId}`);
  }

  async processPrediction(requestId: string, propertyType: string): Promise<ApiResponse<PredictionResult>> {
    return this.request(`/api/predictions/process/${requestId}`, {
      method: 'POST',
      body: JSON.stringify({ propertyType }),
    });
  }

  async getPredictionHistory(query: PredictionHistoryQuery = {}): Promise<ApiResponse<PredictionResult[]>> {
    const params = new URLSearchParams();
    if (query.areaId) params.append('areaId', query.areaId);
    if (query.userId) params.append('userId', query.userId);
    if (query.startDate) params.append('startDate', query.startDate.toISOString());
    if (query.endDate) params.append('endDate', query.endDate.toISOString());
    
    const queryString = params.toString();
    return this.request(`/api/predictions/history${queryString ? `?${queryString}` : ''}`);
  }

  async getPredictionStatistics(areaId: string): Promise<ApiResponse<AccuracyMetrics>> {
    return this.request(`/api/predictions/statistics/${areaId}`);
  }

  async validatePredictionRequest(request: CreatePredictionRequest): Promise<ApiResponse<{ isValid: boolean; errors: string[] }>> {
    return this.request('/api/predictions/validate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Crawler-related API calls
  async triggerCrawl(areaId: string): Promise<ApiResponse<{ jobId: string }>> {
    return this.request('/api/crawler/trigger', {
      method: 'POST',
      body: JSON.stringify({ areaId }),
    });
  }

  async getCrawlStatus(jobId: string): Promise<ApiResponse<{ status: string; progress: number }>> {
    return this.request(`/api/crawler/status/${jobId}`);
  }

  // Cache management
  async clearAreaCache(areaId: string): Promise<ApiResponse<never>> {
    return this.request(`/api/cache/area/${areaId}`, {
      method: 'DELETE',
    });
  }

  async getCacheStats(): Promise<ApiResponse<any>> {
    return this.request('/api/cache/stats');
  }

  // Service monitoring
  async getServiceHealth(): Promise<ApiResponse<any>> {
    return this.request('/api/services');
  }

  // Utility method for polling prediction results
  async pollPredictionResult(
    requestId: string, 
    maxAttempts: number = 30, 
    intervalMs: number = 2000
  ): Promise<PredictionResult> {
    console.log(`[POLLING] Starting to poll for requestId: ${requestId}, maxAttempts: ${maxAttempts}, interval: ${intervalMs}ms`);
    
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      console.log(`[POLLING] Attempt ${attempts + 1}/${maxAttempts} for requestId: ${requestId}`);
      
      try {
        const response = await this.getPredictionResult(requestId);
        
        if (response.success && response.data) {
          console.log(`[POLLING] Success! Found result on attempt ${attempts + 1} for requestId: ${requestId}`);
          return response.data;
        }
        
        console.log(`[POLLING] Response received but no data, attempt ${attempts + 1}`);
      } catch (error) {
        console.log(`[POLLING] Attempt ${attempts + 1} failed:`, error instanceof Error ? error.message : error);
        
        // If it's a 404 or "Prediction result not found", the prediction might still be processing
        const errorMessage = error instanceof Error ? error.message : String(error);
        const is404Error = errorMessage.includes('404') || 
                          errorMessage.includes('Not Found') ||
                          errorMessage.includes('Prediction result not found');
        
        if (is404Error) {
          console.log(`[POLLING] 404/Not Found error - prediction still processing, will retry...`);
          // Continue to the next iteration (don't throw)
        } else {
          // For non-404 errors, throw immediately
          console.log(`[POLLING] Non-404 error, throwing:`, error);
          throw error;
        }
      }
      
      // Wait before next attempt (except for the last attempt)
      if (attempts < maxAttempts - 1) {
        console.log(`[POLLING] Waiting ${intervalMs}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    console.log(`[POLLING] Timeout after ${maxAttempts} attempts for requestId: ${requestId}`);
    throw new Error(`Prediction request timed out after ${maxAttempts} attempts`);
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();
export default apiService;