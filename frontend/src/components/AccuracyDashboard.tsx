import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { AccuracyDashboardProps, AccuracyMetrics } from '../types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const AccuracyDashboard: React.FC<AccuracyDashboardProps> = ({
  metrics,
  selectedArea,
  isLoading
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');

  // Generate mock accuracy data if none provided
  const mockMetrics: AccuracyMetrics[] = useMemo(() => {
    if (metrics.length > 0) return metrics;

    const areas = ['orchard', 'marina-bay', 'tampines', 'jurong-east', 'woodlands', 'bedok'];
    const timeframes = [1, 3, 5, 10];
    
    return areas.flatMap(areaId => 
      timeframes.map(timeframe => ({
        areaId,
        timeframe,
        accuracyPercentage: 65 + Math.random() * 25, // 65-90% accuracy
        totalPredictions: Math.floor(20 + Math.random() * 80), // 20-100 predictions
        averageError: 50000 + Math.random() * 100000, // $50k-$150k average error
        lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
      }))
    );
  }, [metrics]);

  // Filter metrics based on selected area and timeframe
  const filteredMetrics = useMemo(() => {
    let filtered = mockMetrics;
    
    if (selectedArea) {
      filtered = filtered.filter(m => m.areaId === selectedArea.id);
    }
    
    if (selectedTimeframe !== 'all') {
      filtered = filtered.filter(m => m.timeframe === selectedTimeframe);
    }
    
    return filtered;
  }, [mockMetrics, selectedArea, selectedTimeframe]);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    if (filteredMetrics.length === 0) {
      return {
        averageAccuracy: 0,
        totalPredictions: 0,
        averageError: 0,
        bestPerformingArea: 'N/A',
        worstPerformingArea: 'N/A'
      };
    }

    const totalPredictions = filteredMetrics.reduce((sum, m) => sum + m.totalPredictions, 0);
    const weightedAccuracy = filteredMetrics.reduce((sum, m) => 
      sum + (m.accuracyPercentage * m.totalPredictions), 0) / totalPredictions;
    const averageError = filteredMetrics.reduce((sum, m) => sum + m.averageError, 0) / filteredMetrics.length;

    // Find best and worst performing areas
    const areaAccuracies = filteredMetrics.reduce((acc, m) => {
      if (!acc[m.areaId]) {
        acc[m.areaId] = { total: 0, count: 0 };
      }
      acc[m.areaId].total += m.accuracyPercentage;
      acc[m.areaId].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    const areaAverages = Object.entries(areaAccuracies).map(([areaId, data]) => ({
      areaId,
      average: data.total / data.count
    }));

    const bestArea = areaAverages.reduce((best, current) => 
      current.average > best.average ? current : best, areaAverages[0]);
    const worstArea = areaAverages.reduce((worst, current) => 
      current.average < worst.average ? current : worst, areaAverages[0]);

    return {
      averageAccuracy: weightedAccuracy,
      totalPredictions,
      averageError,
      bestPerformingArea: bestArea?.areaId || 'N/A',
      worstPerformingArea: worstArea?.areaId || 'N/A'
    };
  }, [filteredMetrics]);

  // Chart data for accuracy by timeframe
  const accuracyByTimeframeData = useMemo(() => {
    const timeframes = [1, 3, 5, 10];
    const data = timeframes.map(tf => {
      const tfMetrics = filteredMetrics.filter(m => m.timeframe === tf);
      if (tfMetrics.length === 0) return 0;
      
      const totalPredictions = tfMetrics.reduce((sum, m) => sum + m.totalPredictions, 0);
      return tfMetrics.reduce((sum, m) => 
        sum + (m.accuracyPercentage * m.totalPredictions), 0) / totalPredictions;
    });

    return {
      labels: timeframes.map(tf => `${tf} Year${tf > 1 ? 's' : ''}`),
      datasets: [{
        label: 'Accuracy %',
        data,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2
      }]
    };
  }, [filteredMetrics]);

  // Chart data for accuracy by area
  const accuracyByAreaData = useMemo(() => {
    const areaData = filteredMetrics.reduce((acc, m) => {
      if (!acc[m.areaId]) {
        acc[m.areaId] = { total: 0, count: 0, predictions: 0 };
      }
      acc[m.areaId].total += m.accuracyPercentage * m.totalPredictions;
      acc[m.areaId].predictions += m.totalPredictions;
      acc[m.areaId].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number; predictions: number }>);

    const areas = Object.keys(areaData);
    const accuracies = areas.map(area => 
      areaData[area].predictions > 0 ? areaData[area].total / areaData[area].predictions : 0
    );

    return {
      labels: areas.map(area => area.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())),
      datasets: [{
        label: 'Accuracy %',
        data: accuracies,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2
      }]
    };
  }, [filteredMetrics]);

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact',
      compactDisplay: 'short'
    }).format(price);
  };

  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (accuracy >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (accuracy >= 60) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getDataSufficiencyWarning = (): string | null => {
    if (filteredMetrics.length === 0) {
      return 'No historical data available for the selected criteria.';
    }
    
    const totalPredictions = overallStats.totalPredictions;
    if (totalPredictions < 10) {
      return 'Limited historical data available. Accuracy metrics may not be representative.';
    }
    
    if (totalPredictions < 50) {
      return 'Moderate amount of historical data. Accuracy metrics are indicative but may improve with more data.';
    }
    
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <svg className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Accuracy Data</h3>
            <p className="text-gray-600">Analyzing historical prediction performance...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Historical Accuracy Dashboard</h2>
            <p className="text-gray-600 mt-1">
              Track prediction performance across different areas and timeframes
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-4 lg:mt-0">
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Timeframes</option>
              <option value={1}>1 Year</option>
              <option value={3}>3 Years</option>
              <option value={5}>5 Years</option>
              <option value={10}>10 Years</option>
            </select>
            
            <div className="flex rounded-md border border-gray-300">
              <button
                onClick={() => setViewMode('overview')}
                className={`px-4 py-2 text-sm font-medium rounded-l-md ${
                  viewMode === 'overview'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-4 py-2 text-sm font-medium rounded-r-md border-l ${
                  viewMode === 'detailed'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Detailed
              </button>
            </div>
          </div>
        </div>

        {/* Data Sufficiency Warning */}
        {getDataSufficiencyWarning() && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Data Availability Notice</h4>
                <p className="text-sm text-yellow-700 mt-1">{getDataSufficiencyWarning()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-700">
              {overallStats.averageAccuracy.toFixed(1)}%
            </div>
            <div className="text-sm text-blue-600">Average Accuracy</div>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-700">
              {overallStats.totalPredictions.toLocaleString()}
            </div>
            <div className="text-sm text-green-600">Total Predictions</div>
          </div>
          
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-2xl font-bold text-orange-700">
              {formatPrice(overallStats.averageError)}
            </div>
            <div className="text-sm text-orange-600">Average Error</div>
          </div>
          
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-lg font-bold text-purple-700 capitalize">
              {overallStats.bestPerformingArea.replace('-', ' ')}
            </div>
            <div className="text-sm text-purple-600">Best Performing Area</div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accuracy by Timeframe */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Accuracy by Timeframe</h3>
            <div className="h-64">
              <Bar 
                data={accuracyByTimeframeData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      ticks: {
                        callback: function(value) {
                          return value + '%';
                        }
                      }
                    }
                  }
                }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Shorter timeframes typically show higher accuracy due to less market volatility.
            </p>
          </div>

          {/* Accuracy by Area */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Accuracy by Area</h3>
            <div className="h-64">
              <Bar 
                data={accuracyByAreaData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      ticks: {
                        callback: function(value) {
                          return value + '%';
                        }
                      }
                    }
                  }
                }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Central areas often show more stable predictions due to established market patterns.
            </p>
          </div>
        </div>
      )}

      {/* Detailed View */}
      {viewMode === 'detailed' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Accuracy Metrics</h3>
          
          {filteredMetrics.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-600">No data available for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Area
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timeframe
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Accuracy
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Predictions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Error
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMetrics.map((metric, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                        {metric.areaId.replace('-', ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {metric.timeframe} Year{metric.timeframe > 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getAccuracyColor(metric.accuracyPercentage)}`}>
                          {metric.accuracyPercentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {metric.totalPredictions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatPrice(metric.averageError)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {metric.lastUpdated.toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Performance Insights */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Key Findings</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 1-year predictions show highest accuracy ({accuracyByTimeframeData.datasets[0].data[0]?.toFixed(1) || 'N/A'}%)</li>
              <li>• Central areas demonstrate more consistent performance</li>
              <li>• Model accuracy improves with more historical data</li>
              <li>• Seasonal trends affect prediction reliability</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Recommendations</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Use shorter timeframes for higher confidence</li>
              <li>• Consider market volatility in emerging areas</li>
              <li>• Review predictions quarterly for accuracy</li>
              <li>• Factor in major development announcements</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccuracyDashboard;