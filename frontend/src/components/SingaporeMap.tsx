import React, { useState, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMapEvents, useMap, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Area, MapComponentProps } from '../types';

// Singapore boundary coordinates (simplified polygon)
const singaporeBoundary = {
  type: "Feature" as const,
  properties: {
    name: "Singapore"
  },
  geometry: {
    type: "Polygon" as const,
    coordinates: [[
      [103.6, 1.16],
      [104.1, 1.16],
      [104.1, 1.48],
      [103.6, 1.48],
      [103.6, 1.16]
    ]]
  }
};

// Enhanced URA district colors for better visualization
const getDistrictColor = (uraCode?: string): string => {
  if (!uraCode) return '#3388ff';

  const districtNum = parseInt(uraCode.substring(1) || '0');

  if (districtNum <= 8) return '#e74c3c';      // Central districts - Red
  if (districtNum <= 15) return '#f39c12';     // Prime districts - Orange  
  if (districtNum <= 20) return '#2ecc71';     // Mature estates - Green
  return '#3498db';                            // Non-mature/Outer - Blue
};

const getDistrictOpacity = (uraCode?: string): number => {
  if (!uraCode) return 0.6;

  const districtNum = parseInt(uraCode.substring(1) || '0');

  if (districtNum <= 8) return 0.8;      // Central districts - More opaque
  if (districtNum <= 15) return 0.7;     // Prime districts
  if (districtNum <= 20) return 0.6;     // Mature estates
  return 0.5;                            // Non-mature/Outer - More transparent
};

interface MapClickHandlerProps {
  onMapClick: (latlng: L.LatLng) => void;
}

const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    }
  });
  return null;
};

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

const MapControls: React.FC<MapControlsProps> = ({ onZoomIn, onZoomOut, onResetView }) => {
  const map = useMap();

  const handleZoomIn = () => {
    map.zoomIn();
    onZoomIn();
  };

  const handleZoomOut = () => {
    map.zoomOut();
    onZoomOut();
  };

  const handleResetView = () => {
    map.setView([1.3521, 103.8198], 11);
    onResetView();
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <button
        onClick={handleZoomIn}
        className="bg-white hover:bg-gray-50 border border-gray-300 rounded p-2 shadow-md transition-colors"
        title="Zoom In"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
      <button
        onClick={handleZoomOut}
        className="bg-white hover:bg-gray-50 border border-gray-300 rounded p-2 shadow-md transition-colors"
        title="Zoom Out"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <button
        onClick={handleResetView}
        className="bg-white hover:bg-gray-50 border border-gray-300 rounded p-2 shadow-md transition-colors"
        title="Reset View"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
};

const SingaporeMap: React.FC<MapComponentProps> = ({
  areas,
  selectedArea,
  onAreaSelect,
  onAreaHover
}) => {

  const [clickedLocation, setClickedLocation] = useState<L.LatLng | null>(null);

  // Singapore center coordinates
  const singaporeCenter: [number, number] = [1.3521, 103.8198];

  const handleMapClick = useCallback((latlng: L.LatLng) => {
    setClickedLocation(latlng);

    // Find the closest area to the clicked location
    if (areas.length > 0) {
      let closestArea: Area | null = null;
      let minDistance = Infinity;

      areas.forEach(area => {
        if (!area.coordinates || typeof area.coordinates.latitude !== 'number' || typeof area.coordinates.longitude !== 'number') {
          return; // Skip areas with invalid coordinates
        }
        const distance = Math.sqrt(
          Math.pow(area.coordinates.latitude - latlng.lat, 2) +
          Math.pow(area.coordinates.longitude - latlng.lng, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestArea = area;
        }
      });

      // Only select if the click is reasonably close (within ~0.02 degrees)
      if (closestArea && minDistance < 0.02) {
        onAreaSelect(closestArea);
      }
    }
  }, [areas, onAreaSelect]);



  // Create GeoJSON features for Singapore boundary
  const singaporeFeature = {
    type: "FeatureCollection" as const,
    features: [singaporeBoundary]
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={singaporeCenter}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
        zoomControl={false} // We'll add custom controls
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Singapore boundary */}
        <GeoJSON
          data={singaporeBoundary}
          style={{
            fillColor: 'transparent',
            weight: 3,
            opacity: 1,
            color: '#1F2937',
            dashArray: '5, 5',
            fillOpacity: 0
          }}
        />

        {/* Singapore boundary */}
        <GeoJSON
          data={singaporeFeature}
          style={() => ({
            fillColor: 'transparent',
            weight: 2,
            opacity: 0.5,
            color: '#6B7280',
            dashArray: '10, 5',
            fillOpacity: 0
          })}
        />

        {/* Area markers for precise selection */}
        {areas.filter(area => area.coordinates && typeof area.coordinates.latitude === 'number' && typeof area.coordinates.longitude === 'number').map((area) => {
          const isSelected = selectedArea?.id === area.id;

          // Get district-specific styling
          const districtColorClass = area.uraCode ? {
            'D01': 'bg-red-500', 'D02': 'bg-red-500', 'D03': 'bg-red-500', 'D04': 'bg-red-500',
            'D05': 'bg-red-500', 'D06': 'bg-red-500', 'D07': 'bg-red-500', 'D08': 'bg-red-500',
            'D09': 'bg-orange-500', 'D10': 'bg-orange-500', 'D11': 'bg-orange-500', 'D12': 'bg-orange-500',
            'D13': 'bg-orange-500', 'D14': 'bg-orange-500', 'D15': 'bg-orange-500',
            'D16': 'bg-green-500', 'D17': 'bg-green-500', 'D18': 'bg-green-500', 'D19': 'bg-green-500', 'D20': 'bg-green-500',
            'D21': 'bg-blue-500', 'D22': 'bg-blue-500', 'D23': 'bg-blue-500', 'D24': 'bg-blue-500',
            'D25': 'bg-blue-500', 'D26': 'bg-blue-500', 'D27': 'bg-blue-500', 'D28': 'bg-blue-500'
          }[area.uraCode] || 'bg-gray-500' : 'bg-gray-500';

          const customIcon = L.divIcon({
            html: `
              <div class="relative">
                <div class="w-5 h-5 rounded-full ${isSelected
                ? 'bg-blue-600 border-2 border-white shadow-lg scale-125'
                : `${districtColorClass} border border-white shadow-md`
              } transform transition-all hover:scale-110">
                  ${area.uraCode ? `<div class="text-white text-xs font-bold leading-5 text-center">${area.uraCode.substring(1) || ''}</div>` : ''}
                </div>
                ${isSelected ? `
                  <div class="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap z-50">
                    ${area.name}
                    ${area.uraCode ? `<br><span class="text-blue-200">${area.uraCode}</span>` : ''}
                  </div>
                ` : ''}
              </div>
            `,
            className: 'custom-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          return (
            <Marker
              key={area.id}
              position={[area.coordinates.latitude, area.coordinates.longitude]}
              icon={customIcon}
              eventHandlers={{
                click: () => onAreaSelect(area),
                mouseover: () => onAreaHover && onAreaHover(area),
                mouseout: () => onAreaHover && onAreaHover(null)
              }}
            >
              <Popup>
                <div className="text-center min-w-[200px]">
                  <h3 className="font-semibold text-lg">{area.name}</h3>
                  <p className="text-sm text-gray-600">{area.district}</p>

                  {/* Enhanced URA District Information */}
                  {area.enhancedInfo && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-left">
                      <p className="text-xs font-medium text-blue-600">
                        URA Code: {area.enhancedInfo.uraCode}
                      </p>
                      <p className="text-xs text-gray-700">
                        Planning Area: {area.enhancedInfo.planningArea}
                      </p>
                      {area.enhancedInfo.subDistricts.length > 0 && (
                        <div className="mt-1">
                          <p className="text-xs font-medium text-gray-600">Sub-districts:</p>
                          <p className="text-xs text-gray-500">
                            {area.enhancedInfo.subDistricts.slice(0, 3).join(', ')}
                            {area.enhancedInfo.subDistricts.length > 3 && ` +${area.enhancedInfo.subDistricts.length - 3} more`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {area.postalCodes && area.postalCodes.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Postal: {area.postalCodes.slice(0, 3).join(', ')}
                      {area.postalCodes.length > 3 && '...'}
                    </p>
                  )}
                  <button
                    onClick={() => onAreaSelect(area)}
                    className={`mt-2 px-3 py-1 rounded text-sm transition-colors ${isSelected
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                  >
                    {isSelected ? 'Selected' : 'Select Area'}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Click location indicator */}
        {clickedLocation && (
          <CircleMarker
            center={[clickedLocation.lat, clickedLocation.lng]}
            radius={8}
            pathOptions={{
              color: '#EF4444',
              fillColor: '#FEE2E2',
              fillOpacity: 0.8,
              weight: 2
            }}
          >
            <Popup>
              <div className="text-center">
                <p className="text-sm">Clicked Location</p>
                <p className="text-xs text-gray-600">
                  {clickedLocation.lat.toFixed(4)}, {clickedLocation.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Map event handlers */}
        <MapClickHandler onMapClick={handleMapClick} />

        {/* Custom map controls */}
        <MapControls
          onZoomIn={() => { }}
          onZoomOut={() => { }}
          onResetView={() => setClickedLocation(null)}
        />
      </MapContainer>

      {/* Enhanced URA District Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3 z-[1000] max-w-xs">
        <h4 className="text-sm font-semibold mb-2">URA District Tiers</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 border border-white flex items-center justify-center text-white text-xs font-bold">1</div>
            <span>Central (D01-D08)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500 border border-white flex items-center justify-center text-white text-xs font-bold">9</div>
            <span>Prime/Mature (D09-D15)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 border border-white flex items-center justify-center text-white text-xs font-bold">16</div>
            <span>Mature Estates (D16-D20)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 border border-white flex items-center justify-center text-white text-xs font-bold">21</div>
            <span>Non-mature/Outer (D21-D28)</span>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
            <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white scale-125"></div>
            <span>Selected District</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Numbers show URA district codes (e.g., D01, D09)
        </p>
      </div>

      {/* Selection info */}
      {selectedArea && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-3 z-[1000] max-w-xs">
          <h4 className="text-sm font-semibold text-green-700">Selected Area</h4>
          <p className="text-sm font-medium">{selectedArea.name}</p>
          <p className="text-xs text-gray-600">{selectedArea.district} District</p>
          {selectedArea.characteristics && (
            <div className="mt-2 text-xs text-gray-500">
              <p>MRT Proximity: {selectedArea.characteristics.mrtProximity}km</p>
              <p>CBD Distance: {selectedArea.characteristics.cbdDistance}km</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SingaporeMap;