import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import SingaporeMap from './components/SingaporeMap';
import PredictionForm from './components/PredictionForm';
import ResultsVisualization from './components/ResultsVisualization';
import AccuracyDashboard from './components/AccuracyDashboard';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { NotificationProvider, useNotificationHelpers } from './components/NotificationSystem';
import HealthStatus from './components/HealthStatus';
import ErrorBoundary from './components/ErrorBoundary';
import { Area, CreatePredictionRequest, PredictionResult } from './types';
import { singaporeAreas } from './data/singaporeAreas';
import apiService from './services/api';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const AppContent: React.FC = () => {
  const { state, dispatch, setSelectedArea, setHoveredArea, setPredictionResult, setActiveTab, setLoading, setError, resetPrediction } = useAppContext();
  const { showSuccess, showError, showWarning, showInfo } = useNotificationHelpers();
  const [currentTimeframe, setCurrentTimeframe] = useState<number>(5);
  const [areas, setAreas] = useState<Area[]>(singaporeAreas); // Fallback to static data

  // Check backend health on component mount
  useEffect(() => {
    checkBackendHealth();
    loadAreas();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkBackendHealth = async () => {
    try {
      console.log('Checking backend health...');
      setLoading('health', true);
      const response = await apiService.checkHealth();
      console.log('Health check response:', response);
      
      if (response.success) {
        console.log('Backend connected successfully');
        showSuccess('Backend Connected', 'Successfully connected to the prediction service');
        dispatch({ type: 'SET_BACKEND_CONNECTION', payload: true });
        dispatch({ type: 'SET_LAST_HEALTH_CHECK', payload: new Date() });
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      console.warn('Backend not available, using demo mode:', error);
      showWarning(
        'Demo Mode Active', 
        'Backend services are not available. Using simulated data for demonstration.'
      );
      dispatch({ type: 'SET_BACKEND_CONNECTION', payload: false });
    } finally {
      setLoading('health', false);
    }
  };

  const loadAreas = async () => {
    try {
      console.log('Loading areas from backend...');
      setLoading('areas', true);
      const response = await apiService.searchAreas({ query: '' });
      console.log('Areas response:', response);
      
      if (response.success && response.data) {
        console.log('Areas loaded successfully:', response.data.length, 'areas');
        setAreas(response.data);
        dispatch({ type: 'SET_AREAS', payload: response.data });
      } else {
        throw new Error('Failed to load areas');
      }
    } catch (error) {
      console.warn('Failed to load areas from backend, using static data:', error);
      // Keep using static data as fallback
      dispatch({ type: 'SET_AREAS', payload: singaporeAreas });
    } finally {
      setLoading('areas', false);
    }
  };

  const handleAreaSelect = (area: Area) => {
    setSelectedArea(area);
    resetPrediction();
  };

  const handleAreaHover = (area: Area | null) => {
    setHoveredArea(area);
  };

  const getBasePricePerSqft = (area: Area, propertyType: 'HDB' | 'Condo' | 'Landed'): number => {
    // Base PSF prices by area and property type
    const basePricesPerSqft: { [key: string]: { HDB: number; Condo: number; Landed: number } } = {
      'orchard': { HDB: 0, Condo: 1800, Landed: 2200 }, // No HDB in Orchard
      'marina-bay': { HDB: 0, Condo: 2000, Landed: 2500 },
      'raffles-place': { HDB: 0, Condo: 1900, Landed: 2300 },
      'tampines': { HDB: 450, Condo: 1200, Landed: 1400 },
      'bedok': { HDB: 420, Condo: 1100, Landed: 1300 },
      'pasir-ris': { HDB: 400, Condo: 1000, Landed: 1200 },
      'jurong-east': { HDB: 380, Condo: 950, Landed: 1100 },
      'clementi': { HDB: 410, Condo: 1050, Landed: 1250 },
      'woodlands': { HDB: 350, Condo: 900, Landed: 1000 },
      'yishun': { HDB: 340, Condo: 850, Landed: 950 },
      'harbourfront': { HDB: 500, Condo: 1400, Landed: 1600 },
      'tiong-bahru': { HDB: 480, Condo: 1300, Landed: 1500 }
    };
    
    const areaPrices = basePricesPerSqft[area.id] || { HDB: 400, Condo: 1000, Landed: 1200 };
    return areaPrices[propertyType] || areaPrices.Condo;
  };

  const calculateGrowthRate = (area: Area, propertyType: 'HDB' | 'Condo' | 'Landed'): number => {
    // Growth rate influenced by area characteristics and property type
    let baseGrowth = 0.03; // 3% base growth
    
    // Property type adjustments
    if (propertyType === 'HDB') {
      baseGrowth = 0.025; // HDB grows slightly slower
    } else if (propertyType === 'Landed') {
      baseGrowth = 0.035; // Landed properties grow faster
    }
    
    const amenityBonus = (area.characteristics.amenityScore - 7) * 0.005;
    const proximityBonus = area.characteristics.mrtProximity < 1 ? 0.01 : 0;
    const cbdBonus = area.characteristics.cbdDistance < 5 ? 0.015 : 0;
    
    return Math.max(0.01, baseGrowth + amenityBonus + proximityBonus + cbdBonus);
  };

  const handlePredictionSubmit = async (request: CreatePredictionRequest) => {
    if (!state.selectedArea) return;

    setLoading('prediction', true);
    setError('prediction', null);
    setCurrentTimeframe(request.timeframeYears);

    try {
      console.log('[PREDICTION] Starting prediction submission...');
      console.log('[PREDICTION] Backend connected:', state.isBackendConnected);
      console.log('[PREDICTION] Request:', request);
      
      if (state.isBackendConnected) {
        // Use real API
        console.log('[PREDICTION] Using real API...');
        showInfo('Processing Request', 'Analyzing market data and development trends...');
        
        console.log('[PREDICTION] Creating prediction request...');
        const createResponse = await apiService.createPredictionRequest(request);
        console.log('[PREDICTION] Create response:', createResponse);
        
        if (!createResponse.success) {
          throw new Error(createResponse.error || 'Failed to create prediction request');
        }

        const requestId = createResponse.data!.requestId;
        console.log('[PREDICTION] Request ID:', requestId);
        
        // Poll for results
        console.log('[PREDICTION] Starting polling...');
        const result = await apiService.pollPredictionResult(requestId, 30, 2000);
        console.log('[PREDICTION] Polling result:', result);
        
        setPredictionResult(result);
        showSuccess('Prediction Complete', 'Your housing price prediction is ready!');
        
      } else {
        // Use demo mode
        showInfo('Demo Mode', 'Generating simulated prediction...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Calculate prediction based on area characteristics and property details
        const basePricePerSqft = getBasePricePerSqft(state.selectedArea, request.propertyType);
        const growthRate = calculateGrowthRate(state.selectedArea, request.propertyType);
        const predictedPricePerSqft = basePricePerSqft * Math.pow(1 + growthRate, request.timeframeYears);
        const predictedPrice = predictedPricePerSqft * (request.unitSize || 1000);
        
        // Create confidence interval (±12% of predicted price)
        const confidenceRange = predictedPrice * 0.12;
        const confidenceRangePerSqft = predictedPricePerSqft * 0.12;
        
        // Generate mock influencing factors
        const influencingFactors = generateInfluencingFactors(state.selectedArea, request.timeframeYears, request.propertyType);
        
        const result: PredictionResult = {
          id: `pred_${Date.now()}`,
          requestId: `req_${Date.now()}`,
          predictedPrice,
          predictedPricePerSqft,
          propertyType: request.propertyType,
          unitSize: request.unitSize || 1000,
          roomType: request.roomType,
          confidenceInterval: {
            lower: predictedPrice - confidenceRange,
            upper: predictedPrice + confidenceRange,
            lowerPerSqft: predictedPricePerSqft - confidenceRangePerSqft,
            upperPerSqft: predictedPricePerSqft + confidenceRangePerSqft
          },
          influencingFactors,
          modelAccuracy: 0.78 + Math.random() * 0.15, // 78-93% accuracy
          generatedAt: new Date()
        };
        
        setPredictionResult(result);
        showSuccess('Demo Prediction Complete', 'Simulated prediction generated successfully!');
      }
      
    } catch (error) {
      console.error('[PREDICTION] Error occurred:', error);
      console.error('[PREDICTION] Error type:', typeof error);
      console.error('[PREDICTION] Error instanceof Error:', error instanceof Error);
      if (error instanceof Error) {
        console.error('[PREDICTION] Error message:', error.message);
        console.error('[PREDICTION] Error stack:', error.stack);
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate prediction. Please try again.';
      console.error('[PREDICTION] Final error message:', errorMessage);
      
      setError('prediction', errorMessage);
      showError('Prediction Failed', errorMessage);
    } finally {
      setLoading('prediction', false);
    }
  };

  const generateInfluencingFactors = (area: Area, timeframe: number, propertyType: 'HDB' | 'Condo' | 'Landed') => {
    let factors = [
      {
        developmentId: 'dev_mrt_expansion',
        impactWeight: 0.25,
        description: `New MRT line extension near ${area.name} (completion in ${timeframe - 1} years)`
      },
      {
        developmentId: 'dev_shopping_mall',
        impactWeight: 0.18,
        description: `Major shopping complex development in ${area.district} district`
      },
      {
        developmentId: 'dev_school_upgrade',
        impactWeight: 0.15,
        description: `Primary school expansion and facility upgrades in the area`
      },
      {
        developmentId: 'dev_business_hub',
        impactWeight: 0.22,
        description: `New business park and office towers planned for ${area.district}`
      },
      {
        developmentId: 'dev_park_recreation',
        impactWeight: 0.12,
        description: `Community park and recreational facilities enhancement`
      }
    ];

    // Add property-specific factors
    if (propertyType === 'HDB') {
      factors.push({
        developmentId: 'dev_hdb_upgrade',
        impactWeight: 0.20,
        description: `HDB upgrading programme and lift modernization in ${area.name}`
      });
    } else if (propertyType === 'Condo') {
      factors.push({
        developmentId: 'dev_luxury_retail',
        impactWeight: 0.16,
        description: `Premium retail and dining establishments opening nearby`
      });
    } else if (propertyType === 'Landed') {
      factors.push({
        developmentId: 'dev_exclusive_club',
        impactWeight: 0.14,
        description: `Exclusive country club and premium amenities development`
      });
    }

    // Adjust factors based on area characteristics
    if (area.characteristics.mrtProximity < 0.5) {
      factors[0].impactWeight *= 0.7; // Less MRT impact if already close
    }
    
    if (area.characteristics.amenityScore > 8.5) {
      factors[1].impactWeight *= 0.8; // Less shopping impact if already high amenity
    }

    return factors.slice(0, 3 + Math.floor(Math.random() * 2)); // 3-4 factors
  };

  // Removed unused formatPrice function

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Singapore Housing Predictor</h1>
          <p className="text-blue-100 mt-2">
            Predict housing prices based on area selection and development data
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Backend Status Indicator */}
        {state.loading.health && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <svg className="animate-spin h-5 w-5 text-blue-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-blue-700">Connecting to backend services...</span>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="mb-6">
          <HealthStatus />
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('prediction')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  state.activeTab === 'prediction'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Price Prediction
              </button>
              <button
                onClick={() => setActiveTab('accuracy')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  state.activeTab === 'accuracy'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Historical Accuracy
              </button>
            </nav>
          </div>
        </div>

        {/* Prediction Tab Content */}
        {state.activeTab === 'prediction' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Map Section */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Select an Area</h2>
                <div className="h-96 rounded-lg overflow-hidden">
                  <SingaporeMap
                    areas={areas}
                    selectedArea={state.selectedArea}
                    onAreaSelect={handleAreaSelect}
                    onAreaHover={handleAreaHover}
                  />
                </div>
                
                {/* Area info display */}
                {state.hoveredArea && state.hoveredArea.id !== state.selectedArea?.id && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900">Hovering: {state.hoveredArea.name}</h4>
                    <p className="text-sm text-blue-700">{state.hoveredArea.district} District</p>
                    <div className="text-xs text-blue-600 mt-1">
                      <span>MRT: {state.hoveredArea.characteristics.mrtProximity}km</span>
                      <span className="ml-3">CBD: {state.hoveredArea.characteristics.cbdDistance}km</span>
                      <span className="ml-3">Amenity Score: {state.hoveredArea.characteristics.amenityScore}/10</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Prediction Form Section */}
              <PredictionForm
                selectedArea={state.selectedArea}
                onSubmit={handlePredictionSubmit}
                isLoading={state.loading.prediction}
              />
            </div>

            {/* Results Visualization */}
            <ResultsVisualization
              result={state.predictionResult}
              isLoading={state.loading.prediction}
              error={state.errors.prediction}
              selectedArea={state.selectedArea}
              timeframeYears={currentTimeframe}
            />

            {/* Mode Notice */}
            {(state.predictionResult || state.loading.prediction) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className={`p-4 rounded-lg ${
                  state.isBackendConnected 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <h4 className={`font-semibold mb-2 ${
                    state.isBackendConnected ? 'text-green-900' : 'text-yellow-900'
                  }`}>
                    {state.isBackendConnected ? '✅ Live Prediction' : '🚧 Demo Mode'}
                  </h4>
                  <p className={`text-sm ${
                    state.isBackendConnected ? 'text-green-700' : 'text-yellow-700'
                  }`}>
                    {state.isBackendConnected 
                      ? 'This prediction uses real-time data from our backend services including web crawling and machine learning models.'
                      : 'Backend services are not available. This prediction uses simulated data for demonstration purposes.'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accuracy Tab Content */}
        {state.activeTab === 'accuracy' && (
          <AccuracyDashboard
            metrics={state.accuracyMetrics}
            selectedArea={state.selectedArea}
            isLoading={state.loading.accuracy}
          />
        )}

        {/* Features Section - Show only on prediction tab */}
        {state.activeTab === 'prediction' && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="text-3xl mb-4">🗺️</div>
              <h3 className="text-lg font-semibold mb-2">Interactive Map</h3>
              <p className="text-gray-600">Select Singapore areas using our interactive map interface</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="text-3xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2">Price Predictions</h3>
              <p className="text-gray-600">Get housing price forecasts for 1-10 year timeframes</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="text-3xl mb-4">🏗️</div>
              <h3 className="text-lg font-semibold mb-2">Development Impact</h3>
              <p className="text-gray-600">See how new developments affect price predictions</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main App component with providers
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
};

export default App;