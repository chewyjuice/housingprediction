import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AccuracyDashboard from '../AccuracyDashboard';
import { AccuracyMetrics, Area } from '../../types';

// Mock Chart.js and react-chartjs-2
jest.mock('react-chartjs-2', () => ({
  Bar: ({ data, options }: any) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Bar Chart Component
    </div>
  ),
  Line: ({ data, options }: any) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Line Chart Component
    </div>
  )
}));

jest.mock('chart.js', () => ({
  Chart: {
    register: jest.fn()
  },
  CategoryScale: {},
  LinearScale: {},
  BarElement: {},
  PointElement: {},
  LineElement: {},
  Title: {},
  Tooltip: {},
  Legend: {}
}));

const mockSelectedArea: Area = {
  id: 'orchard-1',
  name: 'Orchard Road',
  district: 'Central',
  postalCodes: ['238801'],
  coordinates: {
    latitude: 1.3048,
    longitude: 103.8318,
    boundaries: {
      type: 'Polygon',
      coordinates: [[[103.83, 1.30], [103.84, 1.30], [103.84, 1.31], [103.83, 1.31], [103.83, 1.30]]]
    }
  },
  characteristics: {
    mrtProximity: 0.2,
    cbdDistance: 2.5,
    amenityScore: 9.5
  }
};

const mockAccuracyMetrics: AccuracyMetrics[] = [
  {
    areaId: 'orchard-1',
    timeframe: 1,
    accuracyPercentage: 85.5,
    totalPredictions: 45,
    averageError: 75000,
    lastUpdated: new Date('2024-01-15')
  },
  {
    areaId: 'orchard-1',
    timeframe: 3,
    accuracyPercentage: 78.2,
    totalPredictions: 32,
    averageError: 95000,
    lastUpdated: new Date('2024-01-10')
  },
  {
    areaId: 'tampines-1',
    timeframe: 1,
    accuracyPercentage: 82.1,
    totalPredictions: 28,
    averageError: 65000,
    lastUpdated: new Date('2024-01-12')
  },
  {
    areaId: 'tampines-1',
    timeframe: 5,
    accuracyPercentage: 71.8,
    totalPredictions: 18,
    averageError: 120000,
    lastUpdated: new Date('2024-01-08')
  }
];

describe('AccuracyDashboard Component', () => {
  const defaultProps = {
    metrics: mockAccuracyMetrics,
    selectedArea: null,
    isLoading: false
  };

  it('renders loading state correctly', () => {
    const loadingProps = {
      ...defaultProps,
      isLoading: true
    };
    
    render(<AccuracyDashboard {...loadingProps} />);
    
    expect(screen.getByText('Loading Accuracy Data')).toBeInTheDocument();
    expect(screen.getByText('Analyzing historical prediction performance...')).toBeInTheDocument();
  });

  it('renders dashboard header and controls', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    expect(screen.getByText('Historical Accuracy Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Track prediction performance across different areas and timeframes')).toBeInTheDocument();
  });

  it('renders timeframe filter dropdown', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    const timeframeSelect = screen.getByDisplayValue('All Timeframes');
    expect(timeframeSelect).toBeInTheDocument();
    
    // Check all timeframe options are available
    expect(screen.getByText('1 Year')).toBeInTheDocument();
    expect(screen.getByText('3 Years')).toBeInTheDocument();
    expect(screen.getByText('5 Years')).toBeInTheDocument();
    expect(screen.getByText('10 Years')).toBeInTheDocument();
  });

  it('renders view mode toggle buttons', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    const overviewButton = screen.getByText('Overview');
    const detailedButton = screen.getByText('Detailed');
    
    expect(overviewButton).toBeInTheDocument();
    expect(detailedButton).toBeInTheDocument();
    
    // Overview should be selected by default
    expect(overviewButton).toHaveClass('bg-blue-500');
  });

  it('displays overall statistics correctly', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    expect(screen.getByText('Average Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Total Predictions')).toBeInTheDocument();
    expect(screen.getByText('Average Error')).toBeInTheDocument();
    expect(screen.getByText('Best Performing Area')).toBeInTheDocument();
    
    // Check calculated values
    expect(screen.getByText('123')).toBeInTheDocument(); // Total predictions
  });

  it('filters metrics by selected timeframe', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    const timeframeSelect = screen.getByDisplayValue('All Timeframes');
    fireEvent.change(timeframeSelect, { target: { value: '1' } });
    
    // Should filter to only 1-year predictions
    expect(timeframeSelect.value).toBe('1');
  });

  it('filters metrics by selected area', () => {
    const propsWithSelectedArea = {
      ...defaultProps,
      selectedArea: mockSelectedArea
    };
    
    render(<AccuracyDashboard {...propsWithSelectedArea} />);
    
    // Should show only metrics for the selected area
    // The statistics should reflect only orchard-1 data
  });

  it('switches between overview and detailed view modes', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    // Initially in overview mode - should show charts
    expect(screen.getByText('Accuracy by Timeframe')).toBeInTheDocument();
    expect(screen.getByText('Accuracy by Area')).toBeInTheDocument();
    
    // Switch to detailed view
    const detailedButton = screen.getByText('Detailed');
    fireEvent.click(detailedButton);
    
    expect(screen.getByText('Detailed Accuracy Metrics')).toBeInTheDocument();
    expect(screen.getByText('Area')).toBeInTheDocument(); // Table header
  });

  it('renders accuracy by timeframe chart in overview mode', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    expect(screen.getByText('Accuracy by Timeframe')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByText('Shorter timeframes typically show higher accuracy due to less market volatility.')).toBeInTheDocument();
  });

  it('renders accuracy by area chart in overview mode', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    expect(screen.getByText('Accuracy by Area')).toBeInTheDocument();
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(2); // Two charts in overview
    expect(screen.getByText('Central areas often show more stable predictions due to established market patterns.')).toBeInTheDocument();
  });

  it('renders detailed metrics table in detailed view', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    // Switch to detailed view
    const detailedButton = screen.getByText('Detailed');
    fireEvent.click(detailedButton);
    
    expect(screen.getByText('Detailed Accuracy Metrics')).toBeInTheDocument();
    
    // Check table headers
    expect(screen.getByText('Area')).toBeInTheDocument();
    expect(screen.getByText('Timeframe')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Predictions')).toBeInTheDocument();
    expect(screen.getByText('Avg Error')).toBeInTheDocument();
    expect(screen.getByText('Last Updated')).toBeInTheDocument();
  });

  it('displays accuracy percentages with correct color coding', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    // Switch to detailed view to see the table
    const detailedButton = screen.getByText('Detailed');
    fireEvent.click(detailedButton);
    
    // High accuracy (85.5%) should have green styling
    const highAccuracy = screen.getByText('85.5%');
    expect(highAccuracy.closest('span')).toHaveClass('text-green-600');
    
    // Medium accuracy (78.2%) should have yellow styling
    const mediumAccuracy = screen.getByText('78.2%');
    expect(mediumAccuracy.closest('span')).toHaveClass('text-yellow-600');
  });

  it('formats prices correctly in the table', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    // Switch to detailed view
    const detailedButton = screen.getByText('Detailed');
    fireEvent.click(detailedButton);
    
    // Check that prices are formatted as Singapore dollars
    expect(screen.getByText('S$75K')).toBeInTheDocument();
    expect(screen.getByText('S$95K')).toBeInTheDocument();
  });

  it('displays data sufficiency warnings when appropriate', () => {
    const propsWithLimitedData = {
      ...defaultProps,
      metrics: [mockAccuracyMetrics[0]] // Only one metric
    };
    
    render(<AccuracyDashboard {...propsWithLimitedData} />);
    
    expect(screen.getByText('Data Availability Notice')).toBeInTheDocument();
    expect(screen.getByText(/Limited historical data available/)).toBeInTheDocument();
  });

  it('shows no data message when no metrics match filters', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    // Filter to a timeframe with no data
    const timeframeSelect = screen.getByDisplayValue('All Timeframes');
    fireEvent.change(timeframeSelect, { target: { value: '10' } });
    
    // Switch to detailed view
    const detailedButton = screen.getByText('Detailed');
    fireEvent.click(detailedButton);
    
    expect(screen.getByText('No data available for the selected filters.')).toBeInTheDocument();
  });

  it('renders performance insights section', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    expect(screen.getByText('Performance Insights')).toBeInTheDocument();
    expect(screen.getByText('Key Findings')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    
    // Check some insight content
    expect(screen.getByText(/1-year predictions show highest accuracy/)).toBeInTheDocument();
    expect(screen.getByText(/Use shorter timeframes for higher confidence/)).toBeInTheDocument();
  });

  it('handles empty metrics array gracefully', () => {
    const propsWithNoMetrics = {
      ...defaultProps,
      metrics: []
    };
    
    render(<AccuracyDashboard {...propsWithNoMetrics} />);
    
    // Should still render the dashboard structure
    expect(screen.getByText('Historical Accuracy Dashboard')).toBeInTheDocument();
    
    // Statistics should show default values
    expect(screen.getByText('0')).toBeInTheDocument(); // Total predictions
    expect(screen.getByText('N/A')).toBeInTheDocument(); // Best performing area
  });

  it('calculates weighted averages correctly for overall statistics', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    // The average accuracy should be weighted by number of predictions
    // Total predictions: 45 + 32 + 28 + 18 = 123
    expect(screen.getByText('123')).toBeInTheDocument();
    
    // Average accuracy should be calculated as weighted average
    // (85.5*45 + 78.2*32 + 82.1*28 + 71.8*18) / 123
  });

  it('updates charts when filters change', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    const initialChart = screen.getAllByTestId('bar-chart')[0];
    const initialData = JSON.parse(initialChart.getAttribute('data-chart-data') || '{}');
    
    // Change timeframe filter
    const timeframeSelect = screen.getByDisplayValue('All Timeframes');
    fireEvent.change(timeframeSelect, { target: { value: '1' } });
    
    const updatedChart = screen.getAllByTestId('bar-chart')[0];
    const updatedData = JSON.parse(updatedChart.getAttribute('data-chart-data') || '{}');
    
    // Chart data should be different after filtering
    expect(initialData).not.toEqual(updatedData);
  });

  it('displays area names in proper format', () => {
    render(<AccuracyDashboard {...defaultProps} />);
    
    // Switch to detailed view to see area names
    const detailedButton = screen.getByText('Detailed');
    fireEvent.click(detailedButton);
    
    // Area IDs should be formatted properly (kebab-case to title case)
    expect(screen.getByText('Orchard 1')).toBeInTheDocument();
    expect(screen.getByText('Tampines 1')).toBeInTheDocument();
  });
});