import React, { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import SingaporeMap from './components/SingaporeMap';
import PredictionForm from './components/PredictionForm';
import ResultsVisualization from './components/ResultsVisualization';
import AccuracyDashboard from './components/AccuracyDashboard';
import { Area, CreatePredictionRequest, PredictionResult } from './types';
import { singaporeAreas } from './data/singaporeAreas';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const App: React.FC = () => {
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [hoveredArea, setHoveredArea] = useState<Area | null>(null);
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [currentTimeframe, setCurrentTimeframe] = useState<number>(5);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState<boolean>(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'prediction' | 'accuracy'>('prediction');

  const handleAreaSelect = (area: Area) => {
    setSelectedArea(area);
    // Clear previous prediction when area changes
    setPredictionResult(null);
    setPredictionError(null);
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
    if (!selectedArea) return;

    setIsLoadingPrediction(true);
    setPredictionError(null);
    setCurrentTimeframe(request.timeframeYears);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Calculate prediction based on area characteristics and property details
      const basePricePerSqft = getBasePricePerSqft(selectedArea, request.propertyType);
      const growthRate = calculateGrowthRate(selectedArea, request.propertyType);
      const predictedPricePerSqft = basePricePerSqft * Math.pow(1 + growthRate, request.timeframeYears);
      const predictedPrice = predictedPricePerSqft * (request.unitSize || 1000);
      
      // Create confidence interval (±12% of predicted price)
      const confidenceRange = predictedPrice * 0.12;
      const confidenceRangePerSqft = predictedPricePerSqft * 0.12;
      
      // Generate mock influencing factors
      const influencingFactors = generateInfluencingFactors(selectedArea, request.timeframeYears, request.propertyType);
      
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
    } catch (error) {
      setPredictionError('Failed to generate prediction. Please try again.');
      console.error('Prediction error:', error);
    } finally {
      setIsLoadingPrediction(false);
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

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
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('prediction')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'prediction'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Price Prediction
              </button>
              <button
                onClick={() => setActiveTab('accuracy')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'accuracy'
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
        {activeTab === 'prediction' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Map Section */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Select an Area</h2>
                <div className="h-96 rounded-lg overflow-hidden">
                  <SingaporeMap
                    areas={singaporeAreas}
                    selectedArea={selectedArea}
                    onAreaSelect={handleAreaSelect}
                    onAreaHover={handleAreaHover}
                  />
                </div>
                
                {/* Area info display */}
                {hoveredArea && hoveredArea.id !== selectedArea?.id && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900">Hovering: {hoveredArea.name}</h4>
                    <p className="text-sm text-blue-700">{hoveredArea.district} District</p>
                    <div className="text-xs text-blue-600 mt-1">
                      <span>MRT: {hoveredArea.characteristics.mrtProximity}km</span>
                      <span className="ml-3">CBD: {hoveredArea.characteristics.cbdDistance}km</span>
                      <span className="ml-3">Amenity Score: {hoveredArea.characteristics.amenityScore}/10</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Prediction Form Section */}
              <PredictionForm
                selectedArea={selectedArea}
                onSubmit={handlePredictionSubmit}
                isLoading={isLoadingPrediction}
              />
            </div>

            {/* Results Visualization */}
            <ResultsVisualization
              result={predictionResult}
              isLoading={isLoadingPrediction}
              error={predictionError}
              selectedArea={selectedArea}
              timeframeYears={currentTimeframe}
            />

            {/* Demo Notice */}
            {(predictionResult || isLoadingPrediction) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-semibold text-yellow-900 mb-2">🚧 Demo Mode</h4>
                  <p className="text-sm text-yellow-700">
                    This is a demo version. The backend services are not running yet, so predictions are simulated.
                    To get real predictions, start the backend services with a database.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accuracy Tab Content */}
        {activeTab === 'accuracy' && (
          <AccuracyDashboard
            metrics={[]}
            selectedArea={selectedArea}
            isLoading={false}
          />
        )}

        {/* Features Section - Show only on prediction tab */}
        {activeTab === 'prediction' && (
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

export default App;