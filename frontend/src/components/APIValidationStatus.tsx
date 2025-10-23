import React, { useState, useEffect } from 'react';

interface ValidationResult {
  name: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

interface APIValidationStatusProps {
  onValidationComplete?: (isValid: boolean) => void;
}

const APIValidationStatus: React.FC<APIValidationStatusProps> = ({ onValidationComplete }) => {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ success: number; warnings: number; errors: number } | null>(null);

  const runValidation = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/validate-apis');
      const data = await response.json();
      
      if (data.success || data.results) {
        setValidationResults(data.results || []);
        setSummary(data.summary || { success: 0, warnings: 0, errors: 0 });
        onValidationComplete?.(data.summary?.errors === 0);
      } else {
        throw new Error(data.error || 'Validation failed');
      }
    } catch (error) {
      console.error('API validation failed:', error);
      setValidationResults([{
        name: 'Validation Error',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }]);
      setSummary({ success: 0, warnings: 0, errors: 1 });
      onValidationComplete?.(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runValidation();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">API Validation Status</h3>
        <button
          onClick={runValidation}
          disabled={loading}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? 'Validating...' : 'Refresh'}
        </button>
      </div>

      {summary && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-green-600 font-semibold">{summary.success}</div>
              <div className="text-gray-500">Success</div>
            </div>
            <div className="text-center">
              <div className="text-yellow-600 font-semibold">{summary.warnings}</div>
              <div className="text-gray-500">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-red-600 font-semibold">{summary.errors}</div>
              <div className="text-gray-500">Errors</div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Validating APIs...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {validationResults.map((result, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">{getStatusIcon(result.status)}</span>
                <div className="flex-1">
                  <div className="font-medium">{result.name}</div>
                  <div className="text-sm mt-1">{result.message}</div>
                  
                  {result.details && (
                    <div className="mt-2 text-xs">
                      <details className="cursor-pointer">
                        <summary className="font-medium">Details</summary>
                        <div className="mt-1 pl-4 border-l-2 border-gray-200">
                          {Object.entries(result.details).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-600">{key}:</span>
                              <span className="font-mono">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary && summary.errors > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="text-sm font-medium text-red-800 mb-2">🔧 Troubleshooting</h4>
          <div className="text-sm text-red-700 space-y-1">
            {validationResults.some(r => r.name === 'data.gov.sg HDB API' && r.status === 'error') && (
              <div>
                <strong>HDB API Issues:</strong>
                <ul className="list-disc list-inside ml-2 mt-1">
                  <li>Check internet connection</li>
                  <li>Verify data.gov.sg is accessible</li>
                  <li>Resource ID may have changed</li>
                </ul>
              </div>
            )}
            {validationResults.some(r => r.name === 'URA API' && r.status === 'error') && (
              <div>
                <strong>URA API Issues:</strong>
                <ul className="list-disc list-inside ml-2 mt-1">
                  <li>Create backend/config/secrets.json with valid URA access key</li>
                  <li>Visit URA developer portal to get access key</li>
                  <li>Ensure API access is approved by URA</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {summary && summary.errors === 0 && summary.warnings === 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm text-green-700">
            🎉 All APIs validated successfully! Ready for data extraction.
          </div>
        </div>
      )}
    </div>
  );
};

export default APIValidationStatus;