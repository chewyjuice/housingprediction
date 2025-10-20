import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PredictionForm from '../PredictionForm';
import { Area, CreatePredictionRequest } from '../../types';

const mockArea: Area = {
  id: 'orchard-1',
  name: 'Orchard Road',
  district: 'Central',
  postalCodes: ['238801', '238802'],
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

describe('PredictionForm Component', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    selectedArea: mockArea,
    onSubmit: mockOnSubmit,
    isLoading: false
  };

  it('renders form with all required sections', () => {
    render(<PredictionForm {...defaultProps} />);
    
    expect(screen.getByText('Price Prediction Request')).toBeInTheDocument();
    expect(screen.getByText('Selected Area')).toBeInTheDocument();
    expect(screen.getByText('Prediction Timeframe')).toBeInTheDocument();
    expect(screen.getByText('Property Type')).toBeInTheDocument();
    expect(screen.getByText('Get Price Prediction')).toBeInTheDocument();
  });

  it('displays selected area information correctly', () => {
    render(<PredictionForm {...defaultProps} />);
    
    expect(screen.getByText('Orchard Road')).toBeInTheDocument();
    expect(screen.getByText('Central District')).toBeInTheDocument();
  });

  it('shows warning when no area is selected', () => {
    const propsWithoutArea = {
      ...defaultProps,
      selectedArea: null
    };
    
    render(<PredictionForm {...propsWithoutArea} />);
    
    expect(screen.getByText('Please select an area from the map first')).toBeInTheDocument();
  });

  it('renders preset timeframe options', () => {
    render(<PredictionForm {...defaultProps} />);
    
    expect(screen.getByText('1 Year')).toBeInTheDocument();
    expect(screen.getByText('3 Years')).toBeInTheDocument();
    expect(screen.getByText('5 Years')).toBeInTheDocument();
    expect(screen.getByText('10 Years')).toBeInTheDocument();
  });

  it('allows selection of preset timeframes', () => {
    render(<PredictionForm {...defaultProps} />);
    
    const threeYearButton = screen.getByText('3 Years');
    fireEvent.click(threeYearButton);
    
    // Check if the button appears selected (has blue styling)
    expect(threeYearButton.closest('button')).toHaveClass('border-blue-500');
  });

  it('validates custom timeframe input', () => {
    render(<PredictionForm {...defaultProps} />);
    
    const customInput = screen.getByPlaceholderText('Enter years...');
    
    // Test invalid input (too high)
    fireEvent.change(customInput, { target: { value: '15' } });
    expect(screen.getByText('Timeframe must be between 1 and 10 years')).toBeInTheDocument();
    
    // Test invalid input (too low)
    fireEvent.change(customInput, { target: { value: '0' } });
    expect(screen.getByText('Timeframe must be between 1 and 10 years')).toBeInTheDocument();
    
    // Test valid input
    fireEvent.change(customInput, { target: { value: '7' } });
    expect(screen.queryByText('Timeframe must be between 1 and 10 years')).not.toBeInTheDocument();
  });

  it('renders property type selection buttons', () => {
    render(<PredictionForm {...defaultProps} />);
    
    expect(screen.getByText('HDB')).toBeInTheDocument();
    expect(screen.getByText('Condo')).toBeInTheDocument();
    expect(screen.getByText('Landed')).toBeInTheDocument();
  });

  it('updates room type and unit size when property type changes', () => {
    render(<PredictionForm {...defaultProps} />);
    
    const condoButton = screen.getByText('Condo');
    fireEvent.click(condoButton);
    
    // Check if condo-specific room types are available
    const roomTypeSelect = screen.getByDisplayValue(/bedroom/);
    expect(roomTypeSelect).toBeInTheDocument();
  });

  it('validates unit size input', () => {
    render(<PredictionForm {...defaultProps} />);
    
    const unitSizeInput = screen.getByDisplayValue('1000');
    
    // Test invalid input (too small)
    fireEvent.change(unitSizeInput, { target: { value: '100' } });
    expect(screen.getByText('Unit size must be between 200 and 10,000 sqft')).toBeInTheDocument();
    
    // Test invalid input (too large)
    fireEvent.change(unitSizeInput, { target: { value: '15000' } });
    expect(screen.getByText('Unit size must be between 200 and 10,000 sqft')).toBeInTheDocument();
  });

  it('displays prediction summary when form is valid', () => {
    render(<PredictionForm {...defaultProps} />);
    
    expect(screen.getByText('Prediction Summary')).toBeInTheDocument();
    expect(screen.getByText(/Property:/)).toBeInTheDocument();
    expect(screen.getByText(/Unit Size:/)).toBeInTheDocument();
    expect(screen.getByText(/Timeframe:/)).toBeInTheDocument();
    expect(screen.getByText(/Target Area:/)).toBeInTheDocument();
  });

  it('disables submit button when form is invalid', () => {
    const propsWithoutArea = {
      ...defaultProps,
      selectedArea: null
    };
    
    render(<PredictionForm {...propsWithoutArea} />);
    
    const submitButton = screen.getByText('Get Price Prediction');
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when form is valid', () => {
    render(<PredictionForm {...defaultProps} />);
    
    const submitButton = screen.getByText('Get Price Prediction');
    expect(submitButton).not.toBeDisabled();
  });

  it('shows loading state when isLoading is true', () => {
    const loadingProps = {
      ...defaultProps,
      isLoading: true
    };
    
    render(<PredictionForm {...loadingProps} />);
    
    expect(screen.getByText('Generating Prediction...')).toBeInTheDocument();
    const submitButton = screen.getByText('Generating Prediction...');
    expect(submitButton).toBeDisabled();
  });

  it('submits form with correct data', async () => {
    render(<PredictionForm {...defaultProps} />);
    
    // Select 3 years timeframe
    const threeYearButton = screen.getByText('3 Years');
    fireEvent.click(threeYearButton);
    
    // Select Condo property type
    const condoButton = screen.getByText('Condo');
    fireEvent.click(condoButton);
    
    // Submit form
    const submitButton = screen.getByText('Get Price Prediction');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        areaId: 'orchard-1',
        timeframeYears: 3,
        propertyType: 'Condo',
        unitSize: expect.any(Number),
        roomType: expect.any(String)
      });
    });
  });

  it('displays validation errors when form has issues', () => {
    const propsWithoutArea = {
      ...defaultProps,
      selectedArea: null
    };
    
    render(<PredictionForm {...propsWithoutArea} />);
    
    // Try to submit invalid form
    const submitButton = screen.getByText('Get Price Prediction');
    fireEvent.click(submitButton);
    
    expect(screen.getByText('Please fix the following issues:')).toBeInTheDocument();
  });

  it('updates room type options based on property type selection', () => {
    render(<PredictionForm {...defaultProps} />);
    
    // Initially HDB is selected
    expect(screen.getByDisplayValue(/room/)).toBeInTheDocument();
    
    // Switch to Landed
    const landedButton = screen.getByText('Landed');
    fireEvent.click(landedButton);
    
    // Should show landed property room types
    expect(screen.getByDisplayValue(/Terrace|Semi-D|Detached|Bungalow/)).toBeInTheDocument();
  });

  it('automatically updates unit size when room type changes', () => {
    render(<PredictionForm {...defaultProps} />);
    
    const roomTypeSelect = screen.getByDisplayValue(/room/);
    fireEvent.change(roomTypeSelect, { target: { value: '5-room' } });
    
    // Unit size should update to match the selected room type
    const unitSizeInput = screen.getByDisplayValue(/1100/);
    expect(unitSizeInput).toBeInTheDocument();
  });

  it('displays help text with instructions', () => {
    render(<PredictionForm {...defaultProps} />);
    
    expect(screen.getByText('How it works')).toBeInTheDocument();
    expect(screen.getByText(/Select an area on the map above/)).toBeInTheDocument();
    expect(screen.getByText(/Choose your prediction timeframe/)).toBeInTheDocument();
  });

  it('shows timeframe description based on selected years', () => {
    render(<PredictionForm {...defaultProps} />);
    
    // Select 1 year
    const oneYearButton = screen.getByText('1 Year');
    fireEvent.click(oneYearButton);
    
    expect(screen.getByText(/Immediate market outlook/)).toBeInTheDocument();
    
    // Select 10 years
    const tenYearButton = screen.getByText('10 Years');
    fireEvent.click(tenYearButton);
    
    expect(screen.getByText(/Extended investment horizon/)).toBeInTheDocument();
  });

  it('handles form submission errors gracefully', async () => {
    const mockOnSubmitWithError = jest.fn().mockRejectedValue(new Error('Submission failed'));
    
    const propsWithError = {
      ...defaultProps,
      onSubmit: mockOnSubmitWithError
    };
    
    render(<PredictionForm {...propsWithError} />);
    
    const submitButton = screen.getByText('Get Price Prediction');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockOnSubmitWithError).toHaveBeenCalled();
    });
    
    // Form should not be stuck in submitting state
    expect(screen.getByText('Get Price Prediction')).toBeInTheDocument();
  });
});