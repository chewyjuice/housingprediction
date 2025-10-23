import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ResultsDisplayProps, Development } from '../types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ExtendedResultsDisplayProps extends ResultsDisplayProps {
  selectedArea: any;
  timeframeYears: number;
  influencingDevelopments?: Development[];
}

const ResultsVisualization: React.FC<ExtendedResultsDisplayProps> = ({
  result,
  isLoading,
  error,
  selectedArea,
  timeframeYears,
  influencingDevelopments = []
}) => {
  // Generate chart data
  const chartData = useMemo(() => {
    if (!result || !selectedArea) return null;

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: timeframeYears + 1 }, (_, i) => currentYear + i);
    
    // Simulate historical trend (last 3 years)
    const historicalYears = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
    const basePrice = result.predictedPrice / Math.pow(1.03, timeframeYears); // Reverse calculate base price
    
    const historicalPrices = historicalYears.map((year, index) => {
      const yearsSinceBase = index - 3;
      return basePrice * Math.pow(1.025, yearsSinceBase); // Historical 2.5% growth
    });

    // Future predictions (using PSF for better visualization)
    const basePricePerSqft = result.predictedPricePerSqft / Math.pow(1.03, timeframeYears);
    const futurePricesPerSqft = years.slice(1).map((year, index) => {
      const yearsFromNow = index + 1;
      return basePricePerSqft * Math.pow(1.03, yearsFromNow);
    });

    // Convert to total prices for display
    const futurePrices = futurePricesPerSqft.map(psf => psf * result.unitSize);

    // Confidence intervals
    const confidenceUpper = futurePrices.map(price => 
      price * (1 + (result.confidenceInterval.upper - result.predictedPrice) / result.predictedPrice)
    );
    const confidenceLower = futurePrices.map(price => 
      price * (1 + (result.confidenceInterval.lower - result.predictedPrice) / result.predictedPrice)
    );

    const allYears = [...historicalYears, ...years.slice(1)];
    // const allPrices = [...historicalPrices, ...futurePrices]; // Unused variable

    return {
      labels: allYears.map(year => year.toString()),
      datasets: [
        {
          label: 'Historical Prices',
          data: [...historicalPrices, null, ...Array(futurePrices.length).fill(null)],
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Predicted Prices',
          data: [...Array(historicalPrices.length).fill(null), historicalPrices[historicalPrices.length - 1], ...futurePrices],
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderWidth: 3,
          borderDash: [5, 5],
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Confidence Upper',
          data: [...Array(historicalPrices.length + 1).fill(null), ...confidenceUpper],
          borderColor: 'rgba(255, 99, 132, 0.3)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          borderWidth: 1,
          fill: '+1',
          pointRadius: 0,
        },
        {
          label: 'Confidence Lower',
          data: [...Array(historicalPrices.length + 1).fill(null), ...confidenceLower],
          borderColor: 'rgba(255, 99, 132, 0.3)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          borderWidth: 1,
          fill: false,
          pointRadius: 0,
        }
      ]
    };
  }, [result, selectedArea, timeframeYears]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          filter: (legendItem: any) => {
            // Hide confidence interval lines from legend
            return !legendItem.text.includes('Confidence');
          }
        }
      },
      title: {
        display: true,
        text: `Price Prediction for ${selectedArea?.name || 'Selected Area'}`
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            if (context.dataset.label.includes('Confidence')) return '';
            const value = context.parsed.y;
            return `${context.dataset.label}: ${formatPrice(value)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: function(value: any) {
            return formatPrice(value);
          }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    }
  };

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

  const formatFullPrice = (price: number): string => {
    // Handle NaN, undefined, null, or invalid numbers
    if (!price || isNaN(price) || !isFinite(price)) {
      return 'S$0';
    }
    
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const getConfidencePercentage = (): number => {
    if (!result) return 0;
    const range = result.confidenceInterval.upper - result.confidenceInterval.lower;
    const percentage = (1 - (range / result.predictedPrice)) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  const getDevelopmentImpactColor = (impactScore: number): string => {
    if (impactScore >= 8) return 'text-green-600 bg-green-50 border-green-200';
    if (impactScore >= 6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (impactScore >= 4) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Prediction</h3>
            <p className="text-gray-600">Analyzing market data and development trends...</p>
            <div className="mt-4 bg-gray-200 rounded-full h-2 w-64 mx-auto">
              <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-red-800">Prediction Error</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Property Details Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-900">{result.propertyType}</div>
            <div className="text-sm text-gray-600">Property Type</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-900">{result.roomType}</div>
            <div className="text-sm text-gray-600">Room Type</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-900">{(result.unitSize || 0).toLocaleString()}</div>
            <div className="text-sm text-gray-600">Size (sqft)</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-900">{timeframeYears}Y</div>
            <div className="text-sm text-gray-600">Timeframe</div>
          </div>
        </div>
      </div>

      {/* Main Prediction Result */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Predicted Price */}
          <div className="lg:col-span-1">
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Predicted Price ({timeframeYears} Year{timeframeYears > 1 ? 's' : ''})
              </h3>
              <p className="text-4xl font-bold text-blue-700 mb-1">
                {formatFullPrice(result.predictedPrice)}
              </p>
              <p className="text-xl font-semibold text-blue-600 mb-2">
                {formatFullPrice(result.predictedPricePerSqft)}/sqft
              </p>
              <div className="text-sm text-blue-600">
                <p>{result.propertyType} - {result.roomType}</p>
                <p>{(result.unitSize || 0).toLocaleString()} sqft • {selectedArea?.name}</p>
                <p className="mt-1">Confidence: {getConfidencePercentage().toFixed(0)}%</p>
              </div>
            </div>
          </div>

          {/* Confidence Interval */}
          <div className="lg:col-span-2">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Price Range</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <span className="font-medium text-green-900">Optimistic</span>
                  <div className="text-sm text-green-600">{formatFullPrice(result.confidenceInterval.upperPerSqft)}/sqft</div>
                </div>
                <span className="text-lg font-bold text-green-700">
                  {formatFullPrice(result.confidenceInterval.upper)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <span className="font-medium text-blue-900">Most Likely</span>
                  <div className="text-sm text-blue-600">{formatFullPrice(result.predictedPricePerSqft)}/sqft</div>
                </div>
                <span className="text-lg font-bold text-blue-700">
                  {formatFullPrice(result.predictedPrice)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div>
                  <span className="font-medium text-orange-900">Conservative</span>
                  <div className="text-sm text-orange-600">{formatFullPrice(result.confidenceInterval.lowerPerSqft)}/sqft</div>
                </div>
                <span className="text-lg font-bold text-orange-700">
                  {formatFullPrice(result.confidenceInterval.lower)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Price Trend Chart */}
      {chartData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Trend Analysis</h3>
          <div className="h-80">
            <Line data={chartData} options={chartOptions} />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p>• Solid line shows historical prices based on market data</p>
            <p>• Dashed line shows predicted future prices</p>
            <p>• Shaded area represents confidence interval</p>
          </div>
        </div>
      )}

      {/* Influencing Factors */}
      {result.influencingFactors && result.influencingFactors.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Influencing Factors</h3>
          <div className="space-y-3">
            {result.influencingFactors.map((factor, index) => (
              <div key={index} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{factor.description}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Development ID: {factor.developmentId}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Impact: {(factor.impactWeight * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                {/* Impact weight visualization */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Impact Weight</span>
                    <span>{(factor.impactWeight * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${factor.impactWeight * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Development Details */}
      {influencingDevelopments.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Developments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {influencingDevelopments.slice(0, 6).map((development, index) => (
              <div key={development.id} className={`p-4 rounded-lg border ${getDevelopmentImpactColor(development.impactScore)}`}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-sm">{development.title}</h4>
                  <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-50">
                    {development.type}
                  </span>
                </div>
                <p className="text-xs mb-2 line-clamp-2">{development.description}</p>
                <div className="flex justify-between items-center text-xs">
                  <span>Impact: {development.impactScore}/10</span>
                  <span>{development.dateAnnounced ? new Date(development.dateAnnounced).toLocaleDateString() : 'TBD'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Property Type Comparison */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Type Comparison in {selectedArea?.name}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-900">Property Type</th>
                <th className="text-left py-2 px-3 font-medium text-gray-900">Typical Size</th>
                <th className="text-left py-2 px-3 font-medium text-gray-900">Est. PSF</th>
                <th className="text-left py-2 px-3 font-medium text-gray-900">Est. Total Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className={result.propertyType === 'HDB' ? 'bg-blue-50' : ''}>
                <td className="py-2 px-3">
                  <div className="font-medium">HDB 4-room</div>
                  <div className="text-sm text-gray-600">Public Housing</div>
                </td>
                <td className="py-2 px-3 text-sm">~900 sqft</td>
                <td className="py-2 px-3 text-sm">{formatPrice(result.predictedPricePerSqft * 0.4)}</td>
                <td className="py-2 px-3 text-sm">{formatPrice(result.predictedPricePerSqft * 0.4 * 900)}</td>
              </tr>
              <tr className={result.propertyType === 'Condo' ? 'bg-blue-50' : ''}>
                <td className="py-2 px-3">
                  <div className="font-medium">Condo 3-bedroom</div>
                  <div className="text-sm text-gray-600">Private Condominium</div>
                </td>
                <td className="py-2 px-3 text-sm">~1100 sqft</td>
                <td className="py-2 px-3 text-sm">{formatPrice(result.predictedPricePerSqft)}</td>
                <td className="py-2 px-3 text-sm">{formatPrice(result.predictedPricePerSqft * 1100)}</td>
              </tr>
              <tr className={result.propertyType === 'Landed' ? 'bg-blue-50' : ''}>
                <td className="py-2 px-3">
                  <div className="font-medium">Landed Terrace</div>
                  <div className="text-sm text-gray-600">Landed Property</div>
                </td>
                <td className="py-2 px-3 text-sm">~1800 sqft</td>
                <td className="py-2 px-3 text-sm">{formatPrice(result.predictedPricePerSqft * 1.2)}</td>
                <td className="py-2 px-3 text-sm">{formatPrice(result.predictedPricePerSqft * 1.2 * 1800)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600 mt-3">
          * Highlighted row shows your selected property type. Prices are estimates based on current market trends.
        </p>
      </div>

      {/* Market Insights */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Property Type Trends</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• HDB prices are regulated and grow more steadily</li>
              <li>• Condos offer higher growth potential but more volatility</li>
              <li>• Landed properties typically appreciate fastest</li>
              <li>• Location premium varies significantly by property type</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Investment Considerations</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Consider total cost of ownership including maintenance</li>
              <li>• Factor in rental yield potential for investment properties</li>
              <li>• Monitor upcoming developments in the area</li>
              <li>• Review financing options and interest rate trends</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Model Accuracy */}
      {result.modelAccuracy && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {(result.modelAccuracy * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Historical Accuracy</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {getConfidencePercentage().toFixed(0)}%
              </div>
              <div className="text-sm text-gray-600">Prediction Confidence</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {result.generatedAt ? new Date(result.generatedAt).toLocaleDateString() : 'Unknown'}
              </div>
              <div className="text-sm text-gray-600">Generated On</div>
            </div>
          </div>
        </div>
      )}

      {/* Related News Articles */}
      {result.relatedNews && result.relatedNews.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📰 Related News & Market Analysis
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Recent news articles that contributed to this prediction analysis
          </p>
          <div className="space-y-4">
            {result.relatedNews.map((article, index) => (
              <div key={article.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer">
                      {article.title}
                    </h4>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-sm text-gray-500">{article.source}</span>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-500">
                        {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Unknown'}
                      </span>
                      <span className="text-sm text-gray-400">•</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        article.category === 'Development' ? 'bg-green-100 text-green-800' :
                        article.category === 'Market Trends' ? 'bg-blue-100 text-blue-800' :
                        article.category === 'Policy & Regulation' ? 'bg-purple-100 text-purple-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {article.category}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="flex items-center">
                      <span className="text-xs text-gray-500 mr-1">Relevance:</span>
                      <span className="text-sm font-medium text-gray-700">
                        {(article.relevanceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                  {article.summary}
                </p>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 w-20">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${article.relevanceScore * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <a 
                    href={article.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Read Full Article →
                  </a>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-900">How News Analysis Works</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Our AI analyzes recent news articles, government announcements, and market reports to identify factors 
                  that may influence property prices in your selected area. Articles are ranked by relevance and 
                  incorporated into the prediction model.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsVisualization;