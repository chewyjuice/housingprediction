import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useNotificationHelpers } from './NotificationSystem';
import apiService from '../services/api';

interface HealthStatusProps {
  className?: string;
}

const HealthStatus: React.FC<HealthStatusProps> = ({ className = '' }) => {
  const { state, dispatch, setLoading, setError } = useAppContext();
  const { showError, showSuccess } = useNotificationHelpers();
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [isManualCheck, setIsManualCheck] = useState(false);

  useEffect(() => {
    // Initial health check
    checkHealth();

    // Set up periodic health checks every 5 minutes
    const interval = setInterval(checkHealth, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkHealth = async (manual = false) => {
    if (manual) {
      setIsManualCheck(true);
    }
    
    try {
      setLoading('health', true);
      const response = await apiService.checkHealth();
      
      if (response.success) {
        dispatch({ type: 'SET_BACKEND_CONNECTION', payload: true });
        dispatch({ type: 'SET_LAST_HEALTH_CHECK', payload: new Date() });
        setLastCheck(new Date());
        
        if (manual) {
          showSuccess('Connection Successful', 'Backend services are running normally');
        }
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      dispatch({ type: 'SET_BACKEND_CONNECTION', payload: false });
      setError('health', error instanceof Error ? error.message : 'Health check failed');
      
      if (manual) {
        showError('Connection Failed', 'Unable to connect to backend services');
      }
    } finally {
      setLoading('health', false);
      if (manual) {
        setIsManualCheck(false);
      }
    }
  };

  const handleManualCheck = () => {
    checkHealth(true);
  };

  const getStatusColor = () => {
    if (state.loading.health) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (state.isBackendConnected) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getStatusIcon = () => {
    if (state.loading.health) {
      return (
        <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      );
    }
    
    if (state.isBackendConnected) {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    );
  };

  const getStatusText = () => {
    if (state.loading.health) return 'Checking...';
    if (state.isBackendConnected) return 'Connected';
    return 'Disconnected';
  };

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center space-x-3">
        <div className={`flex items-center px-3 py-1 rounded-full text-sm border ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="ml-2 font-medium">{getStatusText()}</span>
        </div>
        
        {lastCheck && (
          <span className="text-xs text-gray-500">
            Last checked: {lastCheck.toLocaleTimeString()}
          </span>
        )}
      </div>
      
      <button
        onClick={handleManualCheck}
        disabled={state.loading.health || isManualCheck}
        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isManualCheck ? 'Checking...' : 'Check Now'}
      </button>
    </div>
  );
};

export default HealthStatus;