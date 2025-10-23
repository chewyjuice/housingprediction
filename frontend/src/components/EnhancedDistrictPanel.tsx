import React, { useState, useEffect } from 'react';
import { Area } from '../types';

interface EnhancedDistrictPanelProps {
  selectedArea: Area | null;
  onRetrainModel: () => void;
}

interface URADistrict {
  code: string;
  district: string;
  planningArea: string;
  subDistricts: string[];
  areaId: string;
}

const EnhancedDistrictPanel: React.FC<EnhancedDistrictPanelProps> = ({
  selectedArea,
  onRetrainModel
}) => {
  const [uraDistricts, setUraDistricts] = useState<URADistrict[]>([]);
  const [loading, setLoading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [modelInfo, setModelInfo] = useState<any>(null);

  useEffect(() => {
    loadURADistricts();
    loadModelInfo();
  }, []);

  const loadURADistricts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/districts/ura');
      const data = await response.json();
      
      if (data.success) {
        setUraDistricts(data.data.districts);
      }
    } catch (error) {
      console.error('Failed to load URA districts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModelInfo = async () => {
    try {
      const response = await fetch('/api/model/info');
      const data = await response.json();
      
      if (data.success) {
        setModelInfo(data.data);
      }
    } catch (error) {
      console.error('Failed to load model info:', error);
    }
  };

  const handleRetrainModel = async () => {
    try {
      setRetraining(true);
      const response = await fetch('/api/model/retrain-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setModelInfo(data.data);
        onRetrainModel();
        alert('Model retrained successfully with enhanced URA district data!');
      } else {
        throw new Error(data.error || 'Retraining failed');
      }
    } catch (error) {
      console.error('Model retraining failed:', error);
      alert('Model retraining failed. Please try again.');
    } finally {
      setRetraining(false);
    }
  };

  const getDistrictTier = (uraCode: string): string => {
    const districtNum = parseInt(uraCode.substring(1));
    
    if (districtNum <= 8) return 'Central';
    if (districtNum <= 15) return 'Prime/Mature';
    if (districtNum <= 20) return 'Mature Estates';
    return 'Non-mature/Outer';
  };

  const getDistrictTierColor = (uraCode: string): string => {
    const districtNum = parseInt(uraCode.substring(1));
    
    if (districtNum <= 8) return 'bg-red-100 text-red-800 border-red-200';
    if (districtNum <= 15) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (districtNum <= 20) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Enhanced URA Districts</h3>
        <button
          onClick={handleRetrainModel}
          disabled={retraining}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            retraining
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {retraining ? 'Retraining...' : 'Retrain Model'}
        </button>
      </div>

      {/* Model Status */}
      {modelInfo && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Current Model Status</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Version:</span>
              <span className="ml-1 font-medium">{modelInfo.version}</span>
            </div>
            <div>
              <span className="text-gray-500">Accuracy:</span>
              <span className="ml-1 font-medium">{(modelInfo.accuracy?.overall * 100 || 0).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-500">Districts:</span>
              <span className="ml-1 font-medium">{Object.keys(modelInfo.modelWeights || {}).length}</span>
            </div>
            <div>
              <span className="text-gray-500">Last Trained:</span>
              <span className="ml-1 font-medium">
                {modelInfo.trainedAt ? new Date(modelInfo.trainedAt).toLocaleDateString() : 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Area Details */}
      {selectedArea && selectedArea.enhancedInfo && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Selected District Details</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium border ${getDistrictTierColor(selectedArea.enhancedInfo.uraCode)}`}>
                {selectedArea.enhancedInfo.uraCode}
              </span>
              <span className="text-sm font-medium">{selectedArea.enhancedInfo.planningArea}</span>
            </div>
            <div className="text-xs text-gray-600">
              <span className="font-medium">Tier:</span> {getDistrictTier(selectedArea.enhancedInfo.uraCode)}
            </div>
            <div className="text-xs text-gray-600">
              <span className="font-medium">Sub-districts:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {selectedArea.enhancedInfo.subDistricts.map((subDistrict, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-100 rounded text-xs">
                    {subDistrict}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* District Summary */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">District Coverage Summary</h4>
        
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-xs text-gray-500 mt-2">Loading URA districts...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-red-50 rounded border border-red-200">
              <div className="font-medium text-red-800">Central (D01-D08)</div>
              <div className="text-red-600">
                {uraDistricts.filter(d => parseInt(d.code.substring(1)) <= 8).length} districts
              </div>
            </div>
            <div className="p-2 bg-orange-50 rounded border border-orange-200">
              <div className="font-medium text-orange-800">Prime (D09-D15)</div>
              <div className="text-orange-600">
                {uraDistricts.filter(d => {
                  const num = parseInt(d.code.substring(1));
                  return num >= 9 && num <= 15;
                }).length} districts
              </div>
            </div>
            <div className="p-2 bg-green-50 rounded border border-green-200">
              <div className="font-medium text-green-800">Mature (D16-D20)</div>
              <div className="text-green-600">
                {uraDistricts.filter(d => {
                  const num = parseInt(d.code.substring(1));
                  return num >= 16 && num <= 20;
                }).length} districts
              </div>
            </div>
            <div className="p-2 bg-blue-50 rounded border border-blue-200">
              <div className="font-medium text-blue-800">Outer (D21-D28)</div>
              <div className="text-blue-600">
                {uraDistricts.filter(d => parseInt(d.code.substring(1)) >= 21).length} districts
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
          Total: {uraDistricts.length} URA districts with enhanced planning area data
        </div>
      </div>
    </div>
  );
};

export default EnhancedDistrictPanel;