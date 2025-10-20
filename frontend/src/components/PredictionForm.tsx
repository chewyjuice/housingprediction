import React, { useState, useEffect } from 'react';
import { Area, PredictionFormProps, CreatePredictionRequest } from '../types';

interface PredictionFormState {
  timeframeYears: number;
  customTimeframe: string;
  propertyType: 'HDB' | 'Condo' | 'Landed';
  unitSize: number;
  roomType: string;
  isValid: boolean;
  errors: {
    timeframeYears?: string;
    area?: string;
    propertyType?: string;
    unitSize?: string;
  };
  isSubmitting: boolean;
}

const PredictionForm: React.FC<PredictionFormProps> = ({
  selectedArea,
  onSubmit,
  isLoading
}) => {
  const [formState, setFormState] = useState<PredictionFormState>({
    timeframeYears: 5,
    customTimeframe: '',
    propertyType: 'HDB',
    unitSize: 1000,
    roomType: '4-room',
    isValid: false,
    errors: {},
    isSubmitting: false
  });

  // Preset timeframe options
  const presetTimeframes = [
    { value: 1, label: '1 Year', description: 'Short-term prediction' },
    { value: 3, label: '3 Years', description: 'Medium-term outlook' },
    { value: 5, label: '5 Years', description: 'Long-term planning' },
    { value: 10, label: '10 Years', description: 'Investment horizon' }
  ];

  // Property type configurations
  const propertyConfigs = {
    HDB: {
      roomTypes: [
        { value: '2-room', label: '2-room', size: 450 },
        { value: '3-room', label: '3-room', size: 650 },
        { value: '4-room', label: '4-room', size: 900 },
        { value: '5-room', label: '5-room', size: 1100 },
        { value: 'Executive', label: 'Executive', size: 1400 }
      ]
    },
    Condo: {
      roomTypes: [
        { value: '1-bedroom', label: '1-bedroom', size: 500 },
        { value: '2-bedroom', label: '2-bedroom', size: 750 },
        { value: '3-bedroom', label: '3-bedroom', size: 1100 },
        { value: '4-bedroom', label: '4-bedroom', size: 1500 },
        { value: 'Penthouse', label: 'Penthouse', size: 2500 }
      ]
    },
    Landed: {
      roomTypes: [
        { value: 'Terrace', label: 'Terrace House', size: 1800 },
        { value: 'Semi-D', label: 'Semi-Detached', size: 2500 },
        { value: 'Detached', label: 'Detached House', size: 3500 },
        { value: 'Bungalow', label: 'Bungalow', size: 5000 }
      ]
    }
  };

  // Validate form whenever inputs change
  useEffect(() => {
    validateForm();
  }, [formState.timeframeYears, formState.propertyType, formState.unitSize, selectedArea]);

  const validateForm = () => {
    const errors: { timeframeYears?: string; area?: string; propertyType?: string; unitSize?: string } = {};
    let isValid = true;

    // Validate area selection
    if (!selectedArea) {
      errors.area = 'Please select an area from the map';
      isValid = false;
    }

    // Validate timeframe
    if (formState.timeframeYears < 1 || formState.timeframeYears > 10) {
      errors.timeframeYears = 'Timeframe must be between 1 and 10 years';
      isValid = false;
    }

    if (!Number.isInteger(formState.timeframeYears)) {
      errors.timeframeYears = 'Timeframe must be a whole number';
      isValid = false;
    }

    // Validate unit size
    if (formState.unitSize < 200 || formState.unitSize > 10000) {
      errors.unitSize = 'Unit size must be between 200 and 10,000 sqft';
      isValid = false;
    }

    setFormState(prev => ({
      ...prev,
      errors,
      isValid
    }));
  };

  const handlePresetSelect = (years: number) => {
    setFormState(prev => ({
      ...prev,
      timeframeYears: years,
      customTimeframe: ''
    }));
  };

  const handleCustomTimeframeChange = (value: string) => {
    const numValue = parseInt(value);
    
    setFormState(prev => ({
      ...prev,
      customTimeframe: value,
      timeframeYears: isNaN(numValue) ? prev.timeframeYears : numValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formState.isValid || !selectedArea) {
      return;
    }

    setFormState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const request: CreatePredictionRequest = {
        areaId: selectedArea.id,
        timeframeYears: formState.timeframeYears,
        propertyType: formState.propertyType,
        unitSize: formState.unitSize,
        roomType: formState.roomType
      };

      await onSubmit(request);
    } catch (error) {
      console.error('Prediction request failed:', error);
    } finally {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const getTimeframeDescription = (years: number): string => {
    if (years <= 1) return 'Immediate market outlook';
    if (years <= 3) return 'Short to medium-term trends';
    if (years <= 5) return 'Medium-term investment planning';
    if (years <= 7) return 'Long-term market cycles';
    return 'Extended investment horizon';
  };

  const isPresetSelected = (years: number): boolean => {
    return formState.timeframeYears === years && formState.customTimeframe === '';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-6">Price Prediction Request</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Area Selection Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selected Area
          </label>
          {selectedArea ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-green-900">{selectedArea.name}</p>
                  <p className="text-sm text-green-700">{selectedArea.district} District</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-yellow-800">Please select an area from the map first</p>
              </div>
            </div>
          )}
          {formState.errors.area && (
            <p className="mt-1 text-sm text-red-600">{formState.errors.area}</p>
          )}
        </div>

        {/* Preset Timeframe Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Prediction Timeframe
          </label>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {presetTimeframes.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePresetSelect(preset.value)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  isPresetSelected(preset.value)
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="font-medium">{preset.label}</div>
                <div className="text-sm text-gray-600">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Timeframe Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Timeframe (1-10 years)
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              min="1"
              max="10"
              step="1"
              value={formState.customTimeframe}
              onChange={(e) => handleCustomTimeframeChange(e.target.value)}
              placeholder="Enter years..."
              className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">years</span>
          </div>
          {formState.errors.timeframeYears && (
            <p className="mt-1 text-sm text-red-600">{formState.errors.timeframeYears}</p>
          )}
        </div>

        {/* Property Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Property Type
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['HDB', 'Condo', 'Landed'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  const defaultRoom = propertyConfigs[type].roomTypes[1]; // Select middle option
                  setFormState(prev => ({
                    ...prev,
                    propertyType: type,
                    roomType: defaultRoom.value,
                    unitSize: defaultRoom.size
                  }));
                }}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  formState.propertyType === type
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="font-medium">{type}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {type === 'HDB' && 'Public Housing'}
                  {type === 'Condo' && 'Private Condo'}
                  {type === 'Landed' && 'Landed Property'}
                </div>
              </button>
            ))}
          </div>
          {formState.errors.propertyType && (
            <p className="mt-1 text-sm text-red-600">{formState.errors.propertyType}</p>
          )}
        </div>

        {/* Room Type and Unit Size */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Room Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Type
            </label>
            <select
              value={formState.roomType}
              onChange={(e) => {
                const selectedRoom = propertyConfigs[formState.propertyType].roomTypes.find(
                  room => room.value === e.target.value
                );
                setFormState(prev => ({
                  ...prev,
                  roomType: e.target.value,
                  unitSize: selectedRoom?.size || prev.unitSize
                }));
              }}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {propertyConfigs[formState.propertyType].roomTypes.map((room) => (
                <option key={room.value} value={room.value}>
                  {room.label} (~{room.size.toLocaleString()} sqft)
                </option>
              ))}
            </select>
          </div>

          {/* Unit Size Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit Size (sqft)
            </label>
            <input
              type="number"
              min="200"
              max="10000"
              step="50"
              value={formState.unitSize}
              onChange={(e) => setFormState(prev => ({
                ...prev,
                unitSize: parseInt(e.target.value) || 0
              }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            {formState.errors.unitSize && (
              <p className="mt-1 text-sm text-red-600">{formState.errors.unitSize}</p>
            )}
          </div>
        </div>

        {/* Current Selection Summary */}
        {formState.timeframeYears && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Prediction Summary</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p><span className="font-medium">Property:</span> {formState.propertyType} - {formState.roomType}</p>
              <p><span className="font-medium">Unit Size:</span> {formState.unitSize.toLocaleString()} sqft</p>
              <p><span className="font-medium">Timeframe:</span> {formState.timeframeYears} year{formState.timeframeYears > 1 ? 's' : ''}</p>
              <p><span className="font-medium">Description:</span> {getTimeframeDescription(formState.timeframeYears)}</p>
              {selectedArea && (
                <p><span className="font-medium">Target Area:</span> {selectedArea.name}, {selectedArea.district}</p>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={!formState.isValid || formState.isSubmitting || isLoading}
            className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
              formState.isValid && !formState.isSubmitting && !isLoading
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {formState.isSubmitting || isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Prediction...
              </div>
            ) : (
              'Get Price Prediction'
            )}
          </button>
        </div>

        {/* Form Validation Status */}
        {!formState.isValid && (Object.keys(formState.errors).length > 0) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-800">Please fix the following issues:</h4>
                <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                  {Object.values(formState.errors).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">How it works</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Select an area on the map above</li>
          <li>• Choose your prediction timeframe (1-10 years)</li>
          <li>• Our AI analyzes recent developments and market trends</li>
          <li>• Get price predictions with confidence intervals</li>
        </ul>
      </div>
    </div>
  );
};

export default PredictionForm;