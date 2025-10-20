import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResultsVisualization from '../ResultsVisualization';
import { PredictionResult, Development } from '../../types';

// Mock Chart.js and react-chartjs-2
jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options }: any) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Chart Component
    </div>
  ),
  Bar: ({ data, options }: any) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Bar Chart Component
    </div>
  )
}));

jest.mock('chart.js', () => ({
  Chart: {
    register: jest.fn()
  },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  Filler: {}
}));

const mockSelectedArea = {
  id: 'orchard-1',
  name: 'Orchard Road',
  district: 'Central',
  postalCodes: ['238801'],
  coordinates: {
    latitude: 1.3048,
    longitude: 103.8318,
    boundaries: {
      type: 'Polygon' as const,
      coordinates: [[[103.83, 1.30], [103.84, 1.30], [103.84, 1.31], [103.83, 1.31], [103.83, 1.30]]]
    }
  },
  characteristics: {
    mrtProximity: 0.2,
    cbdDistance: 2.5,
    amenityScore: 9.5
  }
};

const mockPredictionResult: PredictionResult = {
  id: 'pred-1',
  requestId: 'req-1',
  predictedPrice: 1200000,
  predictedPricePerSqft: 1200,
  propertyType: 'Condo',
  unitSize: 1000,
  roomType: '3-bedroom',
  confidenceInterval: {
    lower: 1100000,
    upper: 1300000,
    lowerPerSqft: 1100,
    upperPerSqft: 1300
  },
  influencingFactors: [
    {
      developmentId: 'dev-1',
      impactWeight: 0.3,
      description: 'New MRT station construction'
    },
    {
      developmentId: 'dev-2',
      impactWeight: 0.2,
      description: 'Shopping mall development'
    }
  ],
  modelAccuracy: 0.85,
  generatedAt: new Date('2024-01-15')
};

const mockDevelopments: Development[] = [
  {
    id: 'dev-1',
    areaId: 'orchard-1',
    type: 'infrastructure',
    title: 'New MRT Station',
    description: 'Construction of new MRT station to improve connectivity',
    impactScore: 8.5,
    dateAnnounced: new Date('2023-06-01'),
    expectedCompletion: new Date('2025-12-01'),
    source: {
      url: 'https://example.com/news1',
      publisher: 'The Straits Times',
      publishDate: new Date('2023-06-01')
    }
  },
  {
    id: 'dev-2',
    areaId: 'orchard-1',
    type: 'shopping',
    title: 'Premium Shopping Mall',
    description: 'New luxury shopping complex with international brands',
    impactScore: 7.2,
    dateAnnounced: new Date('2023-08-15'),
    source: {
      url: 'https://example.com/news2',
      publisher: 'Channel NewsAsia',
      publishDate: new Date('2023-08-15')
    }
  }
];

describe('ResultsVisualization Component', () => {
  const defaultProps = {
    result: mockPredictionResult,
    isLoading: false,
    error: null,
    selectedArea: mockSelectedArea,
    timeframeYears: 5,
    influencingDevelopments: mockDevelopments
  };

  it('renders loading state correctly', () => {
    const loadingProps = {
      ...defaultProps,
      result: null,
      isLoading: true
    };
    
    render(<ResultsVisualization {...loadingProps} />);
    
    expect(screen.getByText('Generating Prediction')).toBeInTheDocument();
    expect(screen.getByText('Analyzing market data and development trends...')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const errorProps = {
      ...defaultProps,
      result: null,
      error: 'Failed to generate prediction'
    };
    
    render(<ResultsVisualization {...errorProps} />);
    
    expect(screen.getByText('Prediction Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to generate prediction')).toBeInTheDocument();
  });

  it('returns null when no result and not loading', () => {
    const noResultProps = {
      ...defaultProps,
      result: null
    };
    
    const { container } = render(<ResultsVisualization {...noResultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays property details summary', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    expect(screen.getByText('Property Details')).toBeInTheDocument();
    expect(screen.getByText('Condo')).toBeInTheDocument();
    expect(screen.getByText('3-bedroom')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('5Y')).toBeInTheDocument();
  });

  it('displays predicted price with correct formatting', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    expect(screen.getByText(/Predicted Price \(5 Years\)/)).toBeInTheDocument();
    expect(screen.getByText('S$1,200,000')).toBeInTheDocument();
    expect(screen.getByText('S$1,200/sqft')).toBeInTheDocument();
  });

  it('displays confidence interval ranges', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    expect(screen.getByText('Price Range')).toBeInTheDocument();
    expect(screen.getByText('Optimistic')).toBeInTheDocument();
    expect(screen.getByText('Most Likely')).toBeInTheDocument();
    expect(screen.getByText('Conservative')).toBeInTheDocument();
    
    expect(screen.getByText('S$1,300,000')).toBeInTheDocument();
    expect(screen.getByText('S$1,100,000')).toBeInTheDocument();
  });

  it('renders price trend chart', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    expect(screen.getByText('Price Trend Analysis')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('displays influencing factors', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    expect(screen.getByText('Key Influencing Factors')).toBeInTheDocument();
    expect(screen.getByText('New MRT station construction')).toBeInTheDocument();
    expect(screen.getByText('Shopping mall development')).toBeInTheDocument();
    expect(screen.getByText('Impact: 30.0%')).toBeInTheDocument();
    expect(screen.getByText('Impact: 20.0%')).toBeInTheDocument();
  });

  it('displays recent developments section', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    expect(screen.getByText('Recent Developments')).toBeInTheDocument();
    expect(screen.getByText('New MRT Station')).toBeInTheDocument();
    expect(screen.getByText('Premium Shopping Mall')).toBeInTheDocument();
    expect(screen.getByText('infrastructure')).toBeInTheDocument();
    expect(screen.getByText('shopping')).toBeInTheDocument();
  });

  it('displays property type comparison table', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    expect(screen.getByText(/Property Type Comparison in Orchard Road/)).toBeInTheDocument();
    expect(screen.getByText('HDB 4-room')).toBeInTheDocument();
    expect(screen.getByText('Condo 3-bedroom')).toBeInTheDocument();
    expect(screen.getByText('Landed Terrace')).toBeInTheDocument();
  });

  it('highlights selected property type in comparison table', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    // The selected property type (Condo) row should have blue background
    const condoRow = screen.getByText('Condo 3-bedroom').closest('tr');
    expect(condoRow).toHaveClass('bg-blue-50');
  });

  it('displays market insights section', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    expect(screen.getByText('Market Insights')).toBeInTheDocument();
    expect(screen.getByText('Property Type Trends')).toBeInTheDocument();
    expect(screen.getByText('Investment Considerations')).toBeInTheDocument();
  });

  it('displays model performance when accuracy is available', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    expect(screen.getByText('Model Performance')).toBeInTheDocument();
    expect(screen.getByText('85.0%')).toBeInTheDocument();
    expect(screen.getByText('Historical Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Prediction Confidence')).toBeInTheDocument();
  });

  it('formats prices correctly in different contexts', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    // Check various price formats
    expect(screen.getByText('S$1,200,000')).toBeInTheDocument(); // Full price
    expect(screen.getByText('S$1,200/sqft')).toBeInTheDocument(); // Price per sqft
  });

  it('handles missing influencing factors gracefully', () => {
    const propsWithoutFactors = {
      ...defaultProps,
      result: {
        ...mockPredictionResult,
        influencingFactors: []
      }
    };
    
    render(<ResultsVisualization {...propsWithoutFactors} />);
    
    // Should not render influencing factors section
    expect(screen.queryByText('Key Influencing Factors')).not.toBeInTheDocument();
  });

  it('handles missing developments gracefully', () => {
    const propsWithoutDevelopments = {
      ...defaultProps,
      influencingDevelopments: []
    };
    
    render(<ResultsVisualization {...propsWithoutDevelopments} />);
    
    // Should not render developments section
    expect(screen.queryByText('Recent Developments')).not.toBeInTheDocument();
  });

  it('handles missing model accuracy gracefully', () => {
    const propsWithoutAccuracy = {
      ...defaultProps,
      result: {
        ...mockPredictionResult,
        modelAccuracy: undefined
      }
    };
    
    render(<ResultsVisualization {...propsWithoutAccuracy} />);
    
    // Should not render model performance section
    expect(screen.queryByText('Model Performance')).not.toBeInTheDocument();
  });

  it('calculates and displays confidence percentage correctly', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    // Confidence should be calculated based on the range
    const confidenceElements = screen.getAllByText(/Confidence:/);
    expect(confidenceElements.length).toBeGreaterThan(0);
  });

  it('applies correct styling to development impact scores', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    // High impact development (8.5) should have green styling
    const highImpactDev = screen.getByText('New MRT Station').closest('div');
    expect(highImpactDev).toHaveClass('text-green-600');
    
    // Medium impact development (7.2) should have yellow styling
    const mediumImpactDev = screen.getByText('Premium Shopping Mall').closest('div');
    expect(mediumImpactDev).toHaveClass('text-yellow-600');
  });

  it('displays chart with correct data structure', () => {
    render(<ResultsVisualization {...defaultProps} />);
    
    const chart = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
    
    expect(chartData.datasets).toBeDefined();
    expect(chartData.labels).toBeDefined();
    expect(chartData.datasets.length).toBeGreaterThan(0);
  });
});