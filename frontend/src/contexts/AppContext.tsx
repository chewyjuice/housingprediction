import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Area, PredictionResult, AccuracyMetrics } from '../types';

// State interface
interface AppState {
  // Loading states
  loading: {
    areas: boolean;
    prediction: boolean;
    accuracy: boolean;
    health: boolean;
  };
  
  // Error states
  errors: {
    areas: string | null;
    prediction: string | null;
    accuracy: string | null;
    health: string | null;
    general: string | null;
  };
  
  // Data states
  areas: Area[];
  selectedArea: Area | null;
  hoveredArea: Area | null;
  predictionResult: PredictionResult | null;
  predictionHistory: PredictionResult[];
  accuracyMetrics: AccuracyMetrics[];
  
  // UI states
  activeTab: 'prediction' | 'accuracy' | 'data' | 'districts';
  isBackendConnected: boolean;
  lastHealthCheck: Date | null;
}

// Action types
type AppAction =
  | { type: 'SET_LOADING'; payload: { key: keyof AppState['loading']; value: boolean } }
  | { type: 'SET_ERROR'; payload: { key: keyof AppState['errors']; value: string | null } }
  | { type: 'SET_AREAS'; payload: Area[] }
  | { type: 'SET_SELECTED_AREA'; payload: Area | null }
  | { type: 'SET_HOVERED_AREA'; payload: Area | null }
  | { type: 'SET_PREDICTION_RESULT'; payload: PredictionResult | null }
  | { type: 'SET_PREDICTION_HISTORY'; payload: PredictionResult[] }
  | { type: 'SET_ACCURACY_METRICS'; payload: AccuracyMetrics[] }
  | { type: 'SET_ACTIVE_TAB'; payload: 'prediction' | 'accuracy' | 'data' | 'districts' }
  | { type: 'SET_BACKEND_CONNECTION'; payload: boolean }
  | { type: 'SET_LAST_HEALTH_CHECK'; payload: Date }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'RESET_PREDICTION' };

// Initial state
const initialState: AppState = {
  loading: {
    areas: false,
    prediction: false,
    accuracy: false,
    health: false,
  },
  errors: {
    areas: null,
    prediction: null,
    accuracy: null,
    health: null,
    general: null,
  },
  areas: [],
  selectedArea: null,
  hoveredArea: null,
  predictionResult: null,
  predictionHistory: [],
  accuracyMetrics: [],
  activeTab: 'prediction',
  isBackendConnected: false,
  lastHealthCheck: null,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value,
        },
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.key]: action.payload.value,
        },
      };
      
    case 'SET_AREAS':
      return {
        ...state,
        areas: action.payload,
      };
      
    case 'SET_SELECTED_AREA':
      return {
        ...state,
        selectedArea: action.payload,
        // Clear prediction when area changes
        predictionResult: action.payload?.id !== state.selectedArea?.id ? null : state.predictionResult,
      };
      
    case 'SET_HOVERED_AREA':
      return {
        ...state,
        hoveredArea: action.payload,
      };
      
    case 'SET_PREDICTION_RESULT':
      return {
        ...state,
        predictionResult: action.payload,
      };
      
    case 'SET_PREDICTION_HISTORY':
      return {
        ...state,
        predictionHistory: action.payload,
      };
      
    case 'SET_ACCURACY_METRICS':
      return {
        ...state,
        accuracyMetrics: action.payload,
      };
      
    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.payload,
      };
      
    case 'SET_BACKEND_CONNECTION':
      return {
        ...state,
        isBackendConnected: action.payload,
      };
      
    case 'SET_LAST_HEALTH_CHECK':
      return {
        ...state,
        lastHealthCheck: action.payload,
      };
      
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: {
          areas: null,
          prediction: null,
          accuracy: null,
          health: null,
          general: null,
        },
      };
      
    case 'RESET_PREDICTION':
      return {
        ...state,
        predictionResult: null,
        errors: {
          ...state.errors,
          prediction: null,
        },
      };
      
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  
  // Helper functions
  setLoading: (key: keyof AppState['loading'], value: boolean) => void;
  setError: (key: keyof AppState['errors'], value: string | null) => void;
  clearErrors: () => void;
  setSelectedArea: (area: Area | null) => void;
  setHoveredArea: (area: Area | null) => void;
  setPredictionResult: (result: PredictionResult | null) => void;
  setActiveTab: (tab: 'prediction' | 'accuracy' | 'data' | 'districts') => void;
  resetPrediction: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Helper functions
  const setLoading = (key: keyof AppState['loading'], value: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: { key, value } });
  };
  
  const setError = (key: keyof AppState['errors'], value: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: { key, value } });
  };
  
  const clearErrors = () => {
    dispatch({ type: 'CLEAR_ERRORS' });
  };
  
  const setSelectedArea = (area: Area | null) => {
    dispatch({ type: 'SET_SELECTED_AREA', payload: area });
  };
  
  const setHoveredArea = (area: Area | null) => {
    dispatch({ type: 'SET_HOVERED_AREA', payload: area });
  };
  
  const setPredictionResult = (result: PredictionResult | null) => {
    dispatch({ type: 'SET_PREDICTION_RESULT', payload: result });
  };
  
  const setActiveTab = (tab: 'prediction' | 'accuracy' | 'data' | 'districts') => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  };
  
  const resetPrediction = () => {
    dispatch({ type: 'RESET_PREDICTION' });
  };
  
  const contextValue: AppContextType = {
    state,
    dispatch,
    setLoading,
    setError,
    clearErrors,
    setSelectedArea,
    setHoveredArea,
    setPredictionResult,
    setActiveTab,
    resetPrediction,
  };
  
  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Hook to use the context
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export default AppContext;