// Core TypeScript interfaces for Singapore Housing Predictor

export interface Area {
  id: string;
  name: string;
  district: string;
  planningArea?: string;
  uraCode?: string;
  subDistricts?: string[];
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
  enhancedInfo?: {
    uraCode: string;
    planningArea: string;
    subDistricts: string[];
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

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  category: string;
  relevanceScore: number;
  summary: string;
  url: string;
}

export interface MarketAnalysis {
  currentMarketPrice: number;
  marketTrend: number;
  transactionVolume: number;
  priceGrowthRate: number;
  marketConfidence: number;
}

export interface ComparableTransaction {
  price: number;
  pricePerUnit: number;
  date: string;
  area: number;
  type: string;
}

export interface PredictionResult {
  id: string;
  requestId: string;
  predictedPrice: number;
  predictedPricePerSqft: number;
  propertyType: 'HDB' | 'Condo' | 'Landed';
  unitSize: number;
  roomType?: string;
  confidenceInterval: {
    lower: number;
    upper: number;
    lowerPerSqft: number;
    upperPerSqft: number;
  };
  influencingFactors: {
    developmentId: string;
    impactWeight: number;
    description: string;
  }[];
  relatedNews?: NewsArticle[];
  marketAnalysis?: MarketAnalysis;
  comparableTransactions?: ComparableTransaction[];
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
  propertyType: 'HDB' | 'Condo' | 'Landed';
  unitSize?: number; // in sqft
  roomType?: string; // e.g., '3-room', '4-room', '5-room' for HDB
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

// Frontend-specific types
export interface MapViewState {
  center: [number, number];
  zoom: number;
}

export interface MapSelectionState {
  selectedArea: Area | null;
  hoveredArea: Area | null;
  isSelecting: boolean;
}

export interface PredictionFormState {
  areaId: string;
  timeframeYears: number;
  isValid: boolean;
  errors: {
    areaId?: string;
    timeframeYears?: string;
  };
}

export interface AppState {
  map: MapSelectionState;
  prediction: {
    isLoading: boolean;
    currentRequest: PredictionRequest | null;
    currentResult: PredictionResult | null;
    history: PredictionResult[];
    error: string | null;
  };
  areas: {
    all: Area[];
    searchResults: Area[];
    isLoading: boolean;
    error: string | null;
  };
  accuracy: {
    metrics: AccuracyMetrics[];
    isLoading: boolean;
    error: string | null;
  };
}

// Component prop types
export interface MapComponentProps {
  areas: Area[];
  selectedArea: Area | null;
  onAreaSelect: (area: Area) => void;
  onAreaHover: (area: Area | null) => void;
}

export interface PredictionFormProps {
  selectedArea: Area | null;
  onSubmit: (request: CreatePredictionRequest) => void;
  isLoading: boolean;
}

export interface ResultsDisplayProps {
  result: PredictionResult | null;
  isLoading: boolean;
  error: string | null;
}

export interface AccuracyDashboardProps {
  metrics: AccuracyMetrics[];
  selectedArea: Area | null;
  isLoading: boolean;
}

// API client types
export interface ApiClient {
  get<T>(url: string): Promise<ApiResponse<T>>;
  post<T>(url: string, data: any): Promise<ApiResponse<T>>;
  put<T>(url: string, data: any): Promise<ApiResponse<T>>;
  delete<T>(url: string): Promise<ApiResponse<T>>;
}

// Chart data types
export interface ChartDataPoint {
  x: number | string;
  y: number;
}

export interface PredictionChartData {
  historical: ChartDataPoint[];
  predicted: ChartDataPoint[];
  confidenceInterval: {
    upper: ChartDataPoint[];
    lower: ChartDataPoint[];
  };
}

export interface AccuracyChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
  }[];
}