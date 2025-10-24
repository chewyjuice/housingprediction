import React, { useState, useEffect } from 'react';

interface DataSource {
  name: string;
  priority: number;
  isAvailable: boolean;
  lastAttempt?: string;
  lastSuccess?: string;
  errorCount: number;
}

interface DataSourceSummary {
  sources: DataSource[];
  summary: {
    total: number;
    available: number;
    failed: number;
    lastUpdated: string;
  };
}

interface ModelInfo {
  version: string;
  trainedAt: string;
  accuracy: {
    overall: number;
    byPropertyType: {
      HDB: number;
      Condo: number;
      Landed: number;
    };
  };
  dataRange: {
    hdbTransactions: number;
    privateTransactions: number;
  };
}

interface MarketDataSummary {
  totalTransactions: number;
  dataRange: {
    earliest: number | null;
    latest: number | null;
  };
  areasWithData: string[];
  lastUpdated: string | null;
}

const MarketDataStatus: React.FC = () => {
  const [summary, setSummary] = useState<MarketDataSummary | null>(null);
  const [dataSources, setDataSources] = useState<DataSourceSummary | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [extractionResult, setExtractionResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSummary();
    loadDataSources();
    loadModelInfo();
  }, []);

  const loadSummary = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:8000/api/resale/summary');
      const data = await response.json();

      if (data.success) {
        setSummary(data.data);
      }
    } catch (error) {
      console.error('Error loading market data summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDataSources = async () => {
    try {
      // Since we removed data source management endpoints, 
      // we'll show a static status for inference-only mode
      setDataSources({
        sources: [
          { name: 'Model Inference', priority: 1, isAvailable: true, errorCount: 0 },
          { name: 'Market Data', priority: 2, isAvailable: true, errorCount: 0 }
        ],
        summary: {
          total: 2,
          available: 2,
          failed: 0,
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error loading data sources:', error);
    }
  };

  const loadModelInfo = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/model/info');
      const data = await response.json();

      if (data.success && data.data.version) {
        setModelInfo(data.data);
      }
    } catch (error) {
      console.error('Error loading model info:', error);
    }
  };

  // Training and data management functions removed - inference-only mode
  const showInferenceOnlyMessage = () => {
    setExtractionResult('This system is running in inference-only mode. Training and data management are handled offline.');
  };

  const extractMarketData = () => {
    showInferenceOnlyMessage();
  };

  const trainModel = () => {
    showInferenceOnlyMessage();
  };

  const refreshFromSource = (sourceName: string) => {
    showInferenceOnlyMessage();
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const hasData = summary && summary.totalTransactions > 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900">📊 Market Data Status</h3>
        <button
          onClick={extractMarketData}
          disabled={isExtracting}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isExtracting
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gray-400 text-gray-600 cursor-not-allowed'
            }`}
          title="Data management is handled offline in inference-only mode"
        >
          Inference Only
        </button>
      </div>

      {hasData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-900">
                {(summary.totalTransactions || 0).toLocaleString()}
              </div>
              <div className="text-sm text-green-700">Total Transactions</div>
            </div>

            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-900">
                {summary.areasWithData?.length || 0}
              </div>
              <div className="text-sm text-blue-700">Areas Covered</div>
            </div>

            <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-lg font-bold text-purple-900">
                {formatDate(summary.dataRange.earliest)} - {formatDate(summary.dataRange.latest)}
              </div>
              <div className="text-sm text-purple-700">Data Range</div>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Data Quality</h4>
            <div className="flex items-center">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (summary.totalTransactions / 10000) * 100)}%` }}
                ></div>
              </div>
              <span className="ml-3 text-sm text-gray-600">
                {summary.totalTransactions >= 10000 ? 'Excellent' :
                  summary.totalTransactions >= 5000 ? 'Good' :
                    summary.totalTransactions >= 1000 ? 'Fair' : 'Limited'}
              </span>
            </div>
          </div>

          {summary.lastUpdated && (
            <p className="text-sm text-gray-600">
              Last updated: {new Date(summary.lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📈</div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Market Data Available</h4>
          <p className="text-gray-600 mb-4">
            Extract real Singapore resale price data to improve prediction accuracy.
          </p>
          <p className="text-sm text-gray-500">
            This will fetch HDB resale transactions from the Singapore government's open data portal.
          </p>
        </div>
      )}

      {extractionResult && (
        <div className={`mt-4 p-3 rounded-lg border ${extractionResult.startsWith('Error')
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-green-50 border-green-200 text-green-800'
          }`}>
          <p className="text-sm">{extractionResult}</p>
        </div>
      )}

      {/* Trained Model Status */}
      {modelInfo && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-md font-semibold text-gray-900">🧠 Trained Model</h4>
            <button
              onClick={trainModel}
              disabled={true}
              className="px-3 py-1 rounded text-sm font-medium bg-gray-300 text-gray-500 cursor-not-allowed"
              title="Model training is handled offline"
            >
              Offline Training
            </button>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Model Version</div>
                <div className="text-lg font-semibold text-gray-900">{modelInfo.version}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Last Trained</div>
                <div className="text-lg font-semibold text-gray-900">
                  {modelInfo.trainedAt ? new Date(modelInfo.trainedAt).toLocaleDateString() : 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Overall Accuracy</div>
                <div className="text-lg font-semibold text-green-600">
                  {(modelInfo.accuracy.overall * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Training Data</div>
                <div className="text-lg font-semibold text-gray-900">
                  {((modelInfo.dataRange?.hdbTransactions || 0) + (modelInfo.dataRange?.privateTransactions || 0)).toLocaleString()} transactions
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm text-gray-600 mb-2">Accuracy by Property Type</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">HDB</div>
                  <div className="font-semibold text-blue-600">
                    {(modelInfo.accuracy.byPropertyType.HDB * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">Condo</div>
                  <div className="font-semibold text-green-600">
                    {(modelInfo.accuracy.byPropertyType.Condo * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <div className="text-xs text-gray-500">Landed</div>
                  <div className="font-semibold text-purple-600">
                    {(modelInfo.accuracy.byPropertyType.Landed * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-green-900">Fast Inference Ready</h4>
                <p className="text-sm text-green-700 mt-1">
                  Predictions now use pre-trained models for instant results. The model is automatically retrained weekly with fresh URA and government data.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Sources Status */}
      {dataSources && (
        <div className="mt-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">📡 Data Sources</h4>
          <div className="space-y-3">
            {dataSources.sources.map((source, index) => (
              <div key={index} className={`p-3 rounded-lg border ${source.isAvailable
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${source.isAvailable ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {source.name}
                        <span className="ml-2 text-xs text-gray-500">
                          (Priority: {source.priority})
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {source.isAvailable ? (
                          <>
                            ✅ Available
                            {source.lastSuccess && (
                              <span className="ml-2">
                                • Last success: {new Date(source.lastSuccess).toLocaleDateString()}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            ❌ Unavailable
                            <span className="ml-2">• Errors: {source.errorCount}</span>
                            {source.lastAttempt && (
                              <span className="ml-2">
                                • Last attempt: {new Date(source.lastAttempt).toLocaleDateString()}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => refreshFromSource(source.name)}
                    disabled={true}
                    className="px-3 py-1 rounded text-xs font-medium bg-gray-200 text-gray-500 cursor-not-allowed"
                    title="Data refresh is handled offline"
                  >
                    Inference Only
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <strong>Data Source Summary:</strong> {dataSources.summary.available} of {dataSources.summary.total} sources available
              {dataSources.summary.failed > 0 && (
                <span className="text-red-600 ml-2">
                  • {dataSources.summary.failed} failed sources
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-900">Inference-Only Mode</h4>
            <p className="text-sm text-blue-700 mt-1">
              This system is running in inference-only mode for security and performance.
              Model training and data management are handled offline. The system uses pre-trained models
              with Singapore Government Data, URA, and other sources for fast, accurate predictions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketDataStatus;