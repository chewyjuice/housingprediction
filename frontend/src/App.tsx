import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import SingaporeMap from './components/SingaporeMap';
import PredictionForm from './components/PredictionForm';
import ResultsVisualization from './components/ResultsVisualization';
import AccuracyDashboard from './components/AccuracyDashboard';
import MarketDataStatus from './components/MarketDataStatus';
import EnhancedDistrictPanel from './components/EnhancedDistrictPanel';
import APIValidationStatus from './components/APIValidationStatus';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { NotificationProvider, useNotificationHelpers } from './components/NotificationSystem';
import HealthStatus from './components/HealthStatus';
import ErrorBoundary from './components/ErrorBoundary';
import { Area, CreatePredictionRequest, PredictionResult } from './types';
import { singaporeAreas } from './data/singaporeAreas';
import apiService from './services/api';

// Helper functions for enhanced URA district mapping
const getDistrictCoordinates = (uraCode: string): { latitude: number, longitude: number } => {
  const districtCoordinates: { [key: string]: { latitude: number, longitude: number } } = {
    'D01': { latitude: 1.2966, longitude: 103.8547 }, // Downtown Core
    'D02': { latitude: 1.2792, longitude: 103.8480 }, // Outram
    'D03': { latitude: 1.2966, longitude: 103.8038 }, // Queenstown
    'D04': { latitude: 1.2731, longitude: 103.8198 }, // Harbourfront
    'D05': { latitude: 1.3138, longitude: 103.7652 }, // Clementi
    'D06': { latitude: 1.2930, longitude: 103.8520 }, // Museum
    'D07': { latitude: 1.2988, longitude: 103.8581 }, // Rochor
    'D08': { latitude: 1.3200, longitude: 103.8520 }, // Novena
    'D09': { latitude: 1.3048, longitude: 103.8318 }, // Orchard
    'D10': { latitude: 1.3294, longitude: 103.8077 }, // Bukit Timah
    'D11': { latitude: 1.3185, longitude: 103.8436 }, // Newton
    'D12': { latitude: 1.3343, longitude: 103.8474 }, // Toa Payoh
    'D13': { latitude: 1.3200, longitude: 103.8700 }, // Kallang
    'D14': { latitude: 1.3200, longitude: 103.8900 }, // Geylang
    'D15': { latitude: 1.3017, longitude: 103.9056 }, // Marine Parade
    'D16': { latitude: 1.3236, longitude: 103.9273 }, // Bedok
    'D17': { latitude: 1.3571, longitude: 103.9870 }, // Changi
    'D18': { latitude: 1.3496, longitude: 103.9568 }, // Tampines
    'D19': { latitude: 1.3617, longitude: 103.8862 }, // Hougang
    'D20': { latitude: 1.3521, longitude: 103.8198 }, // Bishan
    'D21': { latitude: 1.3587, longitude: 103.7718 }, // Bukit Batok
    'D22': { latitude: 1.3329, longitude: 103.7436 }, // Jurong East
    'D23': { latitude: 1.3773, longitude: 103.7664 }, // Bukit Panjang
    'D24': { latitude: 1.4304, longitude: 103.7171 }, // Lim Chu Kang
    'D25': { latitude: 1.4382, longitude: 103.7890 }, // Woodlands
    'D26': { latitude: 1.4491, longitude: 103.8185 }, // Sembawang
    'D27': { latitude: 1.4294, longitude: 103.8356 }, // Yishun
    'D28': { latitude: 1.4065, longitude: 103.8690 }  // Seletar
  };
  
  return districtCoordinates[uraCode] || { latitude: 1.3521, longitude: 103.8198 }; // Default to Singapore center
};

const getDistrictBoundaries = (uraCode: string): any => {
  // Simplified boundaries - in production, you'd use actual GeoJSON data
  const coords = getDistrictCoordinates(uraCode);
  const offset = 0.015; // Approximate boundary size
  
  return {
    type: 'Polygon',
    coordinates: [[
      [coords.longitude - offset, coords.latitude - offset],
      [coords.longitude + offset, coords.latitude - offset],
      [coords.longitude + offset, coords.latitude + offset],
      [coords.longitude - offset, coords.latitude + offset],
      [coords.longitude - offset, coords.latitude - offset]
    ]]
  };
};

const getDistrictCBDDistance = (uraCode: string): number => {
  const cbdDistances: { [key: string]: number } = {
    'D01': 0.5, 'D02': 1.0, 'D03': 3.0, 'D04': 2.5, 'D05': 8.0,
    'D06': 0.8, 'D07': 1.2, 'D08': 4.0, 'D09': 2.5, 'D10': 6.0,
    'D11': 3.5, 'D12': 5.0, 'D13': 3.0, 'D14': 4.5, 'D15': 7.0,
    'D16': 12.0, 'D17': 20.0, 'D18': 18.0, 'D19': 15.0, 'D20': 10.0,
    'D21': 15.0, 'D22': 25.0, 'D23': 20.0, 'D24': 30.0, 'D25': 28.0,
    'D26': 25.0, 'D27': 22.0, 'D28': 18.0
  };
  
  return cbdDistances[uraCode] || 10.0;
};

const getDistrictAmenityScore = (planningArea: string): number => {
  const amenityScores: { [key: string]: number } = {
    'Orchard': 9.5, 'Downtown Core': 9.0, 'Bukit Timah': 8.5, 'Newton': 8.0,
    'Toa Payoh': 7.5, 'Bishan': 7.5, 'Queenstown': 7.0, 'Marine Parade': 7.0,
    'Bedok': 6.5, 'Tampines': 6.5, 'Hougang': 6.0, 'Jurong East': 6.0,
    'Woodlands': 5.5, 'Yishun': 5.5, 'Clementi': 7.0, 'Geylang': 6.0
  };
  
  return amenityScores[planningArea] || 6.0;
};

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
      console.log('Loading enhanced URA districts from backend...');
      setLoading('areas', true);
      
      // Use comprehensive Singapore district data
      const comprehensiveDistricts = [
        // Central Districts (D01-D08)
        { district: 'District 1', uraCode: 'D01', planningArea: 'Marina Bay', areaId: 'marina-bay' },
        { district: 'District 2', uraCode: 'D02', planningArea: 'Raffles Place', areaId: 'raffles-place' },
        { district: 'District 3', uraCode: 'D03', planningArea: 'Tiong Bahru', areaId: 'tiong-bahru' },
        { district: 'District 4', uraCode: 'D04', planningArea: 'Harbourfront', areaId: 'harbourfront' },
        { district: 'District 5', uraCode: 'D05', planningArea: 'Buona Vista', areaId: 'buona-vista' },
        { district: 'District 6', uraCode: 'D06', planningArea: 'City Hall', areaId: 'city-hall' },
        { district: 'District 7', uraCode: 'D07', planningArea: 'Beach Road', areaId: 'beach-road' },
        { district: 'District 8', uraCode: 'D08', planningArea: 'Little India', areaId: 'little-india' },
        
        // Prime Districts (D09-D15)
        { district: 'District 9', uraCode: 'D09', planningArea: 'Orchard', areaId: 'orchard' },
        { district: 'District 10', uraCode: 'D10', planningArea: 'Tanglin', areaId: 'tanglin' },
        { district: 'District 11', uraCode: 'D11', planningArea: 'Newton', areaId: 'newton' },
        { district: 'District 12', uraCode: 'D12', planningArea: 'Novena', areaId: 'novena' },
        { district: 'District 13', uraCode: 'D13', planningArea: 'Potong Pasir', areaId: 'potong-pasir' },
        { district: 'District 14', uraCode: 'D14', planningArea: 'Geylang', areaId: 'geylang' },
        { district: 'District 15', uraCode: 'D15', planningArea: 'Marine Parade', areaId: 'marine-parade' },
        
        // Mature Districts (D16-D20)
        { district: 'District 16', uraCode: 'D16', planningArea: 'Bedok', areaId: 'bedok' },
        { district: 'District 17', uraCode: 'D17', planningArea: 'Changi', areaId: 'changi' },
        { district: 'District 18', uraCode: 'D18', planningArea: 'Pasir Ris', areaId: 'pasir-ris' },
        { district: 'District 19', uraCode: 'D19', planningArea: 'Tampines', areaId: 'tampines' },
        { district: 'District 20', uraCode: 'D20', planningArea: 'Bishan', areaId: 'bishan' },
        
        // Outer Districts (D21-D28)
        { district: 'District 21', uraCode: 'D21', planningArea: 'Clementi', areaId: 'clementi' },
        { district: 'District 22', uraCode: 'D22', planningArea: 'Jurong East', areaId: 'jurong-east' },
        { district: 'District 23', uraCode: 'D23', planningArea: 'Bukit Batok', areaId: 'bukit-batok' },
        { district: 'District 24', uraCode: 'D24', planningArea: 'Kranji', areaId: 'kranji' },
        { district: 'District 25', uraCode: 'D25', planningArea: 'Woodlands', areaId: 'woodlands' },
        { district: 'District 26', uraCode: 'D26', planningArea: 'Yishun', areaId: 'yishun' },
        { district: 'District 27', uraCode: 'D27', planningArea: 'Sembawang', areaId: 'sembawang' },
        { district: 'District 28', uraCode: 'D28', planningArea: 'Seletar', areaId: 'seletar' }
      ];

      console.log('Loading comprehensive Singapore districts:', comprehensiveDistricts.length, 'districts');
      
      // Convert to Area format
      const enhancedAreas: Area[] = comprehensiveDistricts.map((district: any) => ({
        id: district.areaId,
        name: `${district.district} (${district.planningArea})`,
        district: district.district,
        planningArea: district.planningArea,
        uraCode: district.uraCode,
        subDistricts: [],
        postalCodes: [],
        coordinates: {
          latitude: getDistrictCoordinates(district.uraCode).latitude,
          longitude: getDistrictCoordinates(district.uraCode).longitude,
          boundaries: getDistrictBoundaries(district.uraCode)
        },
        characteristics: {
          mrtProximity: 0.5,
          cbdDistance: getDistrictCBDDistance(district.uraCode),
          amenityScore: getDistrictAmenityScore(district.planningArea)
        },
        enhancedInfo: {
          uraCode: district.uraCode,
          planningArea: district.planningArea,
          subDistricts: []
        }
      }));
      
      setAreas(enhancedAreas);
      dispatch({ type: 'SET_AREAS', payload: enhancedAreas });
      showSuccess('Enhanced Districts Loaded', `Loaded ${enhancedAreas.length} Singapore districts`);
      return;
      
      // Fallback to legacy area search
      const response = await apiService.searchAreas({ query: '' });
      console.log('Legacy areas response:', response);
      
      if (response.success && response.data && Array.isArray(response.data)) {
        const areas: Area[] = response.data as Area[];
        console.log('Legacy areas loaded successfully:', areas.length, 'areas');
        setAreas(areas);
        dispatch({ type: 'SET_AREAS', payload: areas });
      } else {
        throw new Error('Failed to load areas');
      }
    } catch (error) {
      console.warn('Failed to load areas from backend, using static data:', error);
      // Keep using static data as fallback
      dispatch({ type: 'SET_AREAS', payload: singaporeAreas });
      showWarning('Using Static Data', 'Could not load live district data, using fallback areas');
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
        
        // Generate demo news articles
        const demoNews = generateDemoNews(state.selectedArea, request.timeframeYears, request.propertyType);
        
        // Generate demo market analysis
        const demoMarketAnalysis = {
          currentMarketPrice: Math.round(predictedPrice * 0.9), // Slightly lower than prediction
          marketTrend: -2 + Math.random() * 8, // -2% to +6% trend
          transactionVolume: 50 + Math.floor(Math.random() * 200), // 50-250 transactions
          priceGrowthRate: 0.02 + Math.random() * 0.06, // 2-8% annual growth
          marketConfidence: 0.6 + Math.random() * 0.3 // 60-90% confidence
        };
        
        // Generate demo comparable transactions
        const demoComparables = Array.from({ length: 5 }, (_, i) => {
          const variance = 0.8 + Math.random() * 0.4; // ±20% price variance
          const transactionPrice = Math.round(predictedPrice * variance);
          const areaVariance = 0.9 + Math.random() * 0.2; // ±10% area variance
          const transactionArea = Math.round((request.unitSize || 1000) * areaVariance);
          
          return {
            price: transactionPrice,
            pricePerUnit: Math.round(transactionPrice / transactionArea),
            date: new Date(Date.now() - (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString(), // Last few months
            area: transactionArea,
            type: request.propertyType === 'HDB' ? `${request.roomType || '4-room'} HDB` : 
                  request.propertyType === 'Condo' ? 'Condominium' : 'Landed Property'
          };
        });

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
          relatedNews: demoNews,
          marketAnalysis: demoMarketAnalysis,
          comparableTransactions: demoComparables,
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

  const generateDemoNews = (area: Area, timeframe: number, propertyType: 'HDB' | 'Condo' | 'Landed') => {
    const newsTemplates = [
      {
        category: 'Development',
        title: `${area.name} selected for major infrastructure upgrade project`,
        summary: `The government has announced significant infrastructure improvements for ${area.name}, including enhanced connectivity and public amenities. These developments are expected to boost property values over the next ${timeframe} years.`
      },
      {
        category: 'Market Trends',
        title: `${propertyType} prices in ${area.district} show strong growth momentum`,
        summary: `Recent market analysis indicates that ${propertyType} properties in ${area.district} have outperformed the broader market, with sustained demand from both local and foreign buyers driving price appreciation.`
      },
      {
        category: 'Policy & Regulation',
        title: `New housing policies to benefit ${area.district} residents`,
        summary: `Recent policy changes are expected to have a positive impact on the ${area.district} property market, particularly for ${propertyType} properties, with improved financing options and development incentives.`
      },
      {
        category: 'Economic Factors',
        title: `Economic growth drives property investment in ${area.name}`,
        summary: `Strong economic fundamentals and job market growth in the region are attracting property investors to ${area.name}, creating upward pressure on ${propertyType} property prices.`
      }
    ];

    const sources = ['The Straits Times', 'Channel NewsAsia', 'Business Times', 'PropertyGuru'];
    
    return newsTemplates.slice(0, 3).map((template, index) => ({
      id: `demo_news_${index}`,
      title: template.title,
      source: sources[index % sources.length],
      publishedAt: new Date(Date.now() - (index + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(), // Last few weeks
      category: template.category,
      relevanceScore: 0.85 + Math.random() * 0.15, // 85-100% relevance
      summary: template.summary,
      url: `https://demo-news.com/article/${index + 1}`
    }));
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
              <button
                onClick={() => setActiveTab('data')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  state.activeTab === 'data'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Market Data
              </button>
              <button
                onClick={() => setActiveTab('districts')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  state.activeTab === 'districts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Enhanced Districts
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

        {/* Market Data Tab Content */}
        {state.activeTab === 'data' && (
          <MarketDataStatus />
        )}

        {/* Enhanced Districts Tab Content */}
        {state.activeTab === 'districts' && (
          <div className="space-y-6">
            <APIValidationStatus 
              onValidationComplete={(isValid) => {
                if (isValid) {
                  showSuccess('API Validation', 'All APIs validated successfully');
                } else {
                  showWarning('API Validation', 'Some APIs have issues - check validation details');
                }
              }}
            />
            <EnhancedDistrictPanel 
              selectedArea={state.selectedArea}
              onRetrainModel={() => {
                showSuccess('Model Retraining', 'Enhanced model retraining completed successfully');
                // Optionally reload areas or refresh model info
                loadAreas();
              }}
            />
          </div>
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