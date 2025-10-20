// Core TypeScript interfaces for Singapore Housing Predictor

export interface Area {
  id: string;
  name: string;
  district: string;
  postalCodes: string[];
  coordinates: {
    latitude: number;
    longitude: number;
    boundaries: {
      type: 'Polygon';
      coordinates: number[][][];
    };
  };
  characteristics: {
    mrtProximity: number;
    cbdDistance: number;
    amenityScore: number;
  };
}

export interface Development {
  id: string;
  areaId: string;
  type: 'school' | 'infrastructure' | 'shopping' | 'business';
  title: string;
  description: string;
  impactScore: number;
  dateAnnounced: Date;
  expectedCompletion?: Date;
  source: {
    url: string;
    publisher: string;
    publishDate: Date;
  };
}

export interface PredictionRequest {
  id: string;
  areaId: string;
  timeframeYears: number;
  requestDate: Date;
  userId?: string;
}

export interface PredictionResult {
  id: string;
  requestId: string;
  predictedPrice: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  influencingFactors: {
    developmentId: string;
    impactWeight: number;
    description: string;
  }[];
  modelAccuracy?: number;
  generatedAt: Date;
}

export interface HistoricalPrice {
  id: string;
  areaId: string;
  price: number;
  pricePerSqft: number;
  recordDate: Date;
  propertyType: 'HDB' | 'Condo' | 'Landed';
  source: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Area selection related types
export interface AreaSearchQuery {
  query: string;
  district?: string;
  postalCode?: string;
}

export interface AreaValidationRequest {
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

// Prediction related types
export interface CreatePredictionRequest {
  areaId: string;
  timeframeYears: number;
}

export interface PredictionHistoryQuery {
  areaId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

// Accuracy metrics types
export interface AccuracyMetrics {
  areaId: string;
  timeframe: number;
  accuracyPercentage: number;
  totalPredictions: number;
  averageError: number;
  lastUpdated: Date;
}

// Web crawler types
export interface CrawlerJob {
  id: string;
  areaId: string;
  keywords: string[];
  sources: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  publisher: string;
  publishDate: Date;
  extractedAt: Date;
  relevanceScore: number;
}

// Database entity types for backend
export interface AreaEntity extends Omit<Area, 'coordinates'> {
  latitude: number;
  longitude: number;
  boundaries: string; // JSON string
  mrtProximity: number;
  cbdDistance: number;
  amenityScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevelopmentEntity extends Omit<Development, 'dateAnnounced' | 'expectedCompletion' | 'source'> {
  dateAnnounced: Date;
  expectedCompletion?: Date;
  sourceUrl: string;
  sourcePublisher: string;
  sourcePublishDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PredictionRequestEntity extends PredictionRequest {
  createdAt: Date;
  updatedAt: Date;
}

export interface PredictionResultEntity extends Omit<PredictionResult, 'confidenceInterval' | 'influencingFactors'> {
  confidenceLower: number;
  confidenceUpper: number;
  influencingFactors: string; // JSON string
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoricalPriceEntity extends HistoricalPrice {
  createdAt: Date;
  updatedAt: Date;
}