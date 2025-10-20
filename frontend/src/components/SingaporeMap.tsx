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

// Singapore districts with approximate boundaries
const singaporeDistricts = [
  {
    id: 'central',
    name: 'Central',
    coordinates: [[
      [103.82, 1.28],
      [103.87, 1.28],
      [103.87, 1.32],
      [103.82, 1.32],
      [103.82, 1.28]
    ]]
  },
  {
    id: 'north',
    name: 'North',
    coordinates: [[
      [103.75, 1.38],
      [103.85, 1.38],
      [103.85, 1.45],
      [103.75, 1.45],
      [103.75, 1.38]
    ]]
  },
  {
    id: 'east',
    name: 'East',
    coordinates: [[
      [103.87, 1.32],
      [103.98, 1.32],
      [103.98, 1.38],
      [103.87, 1.38],
      [103.87, 1.32]
    ]]
  },
  {
    id: 'west',
    name: 'West',
    coordinates: [[
      [103.65, 1.32],
      [103.82, 1.32],
      [103.82, 1.38],
      [103.65, 1.38],
      [103.65, 1.32]
    ]]
  },
  {
    id: 'south',
    name: 'South',
    coordinates: [[
      [103.75, 1.25],
      [103.85, 1.25],
      [103.85, 1.32],
      [103.75, 1.32],
      [103.75, 1.25]
    ]]
  }
];

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
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
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

  const getDistrictStyle = (districtId: string) => {
    const isHovered = hoveredDistrict === districtId;
    const isSelected = selectedArea?.district.toLowerCase() === districtId;
    
    return {
      fillColor: isSelected ? '#3B82F6' : isHovered ? '#93C5FD' : '#E5E7EB',
      weight: 2,
      opacity: 1,
      color: isSelected ? '#1D4ED8' : '#6B7280',
      dashArray: '',
      fillOpacity: isSelected ? 0.7 : isHovered ? 0.5 : 0.3
    };
  };

  const onEachDistrict = (feature: any, layer: L.Layer) => {
    const districtId = feature.properties.id;
    const districtName = feature.properties.name;
    
    layer.on({
      mouseover: (e) => {
        setHoveredDistrict(districtId);
        onAreaHover && onAreaHover(areas.find(area => 
          area.district.toLowerCase() === districtId
        ) || null);
        
        // Highlight on hover
        const target = e.target;
        target.setStyle({
          weight: 3,
          fillOpacity: 0.6
        });
      },
      mouseout: (e) => {
        setHoveredDistrict(null);
        onAreaHover && onAreaHover(null);
        
        // Reset style
        const target = e.target;
        target.setStyle(getDistrictStyle(districtId));
      },
      click: (e) => {
        // Find areas in this district
        const districtAreas = areas.filter(area => 
          area.district.toLowerCase() === districtId
        );
        
        if (districtAreas.length > 0) {
          // Select the first area in the district or the one closest to click
          const clickLatlng = e.latlng;
          let closestArea = districtAreas[0];
          let minDistance = Infinity;

          districtAreas.forEach(area => {
            const distance = Math.sqrt(
              Math.pow(area.coordinates.latitude - clickLatlng.lat, 2) +
              Math.pow(area.coordinates.longitude - clickLatlng.lng, 2)
            );
            
            if (distance < minDistance) {
              minDistance = distance;
              closestArea = area;
            }
          });

          onAreaSelect(closestArea);
        }
      }
    });

    // Bind popup with district information
    const districtAreasCount = areas.filter(area => 
      area.district.toLowerCase() === districtId
    ).length;
    
    layer.bindPopup(`
      <div class="text-center">
        <h3 class="font-semibold text-lg">${districtName} District</h3>
        <p class="text-sm text-gray-600">${districtAreasCount} areas available</p>
        <p class="text-xs text-gray-500 mt-1">Click to select an area in this district</p>
      </div>
    `);
  };

  // Create GeoJSON features for districts
  const districtFeatures = singaporeDistricts.map(district => ({
    type: "Feature" as const,
    properties: {
      id: district.id,
      name: district.name
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: district.coordinates
    }
  }));

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

        {/* District boundaries */}
        {districtFeatures.map((feature, index) => (
          <GeoJSON
            key={`district-${feature.properties.id}`}
            data={feature}
            style={() => getDistrictStyle(feature.properties.id)}
            onEachFeature={onEachDistrict}
          />
        ))}

        {/* Area markers for precise selection */}
        {areas.map((area) => {
          const isSelected = selectedArea?.id === area.id;
          
          const customIcon = L.divIcon({
            html: `
              <div class="relative">
                <div class="w-4 h-4 rounded-full ${
                  isSelected 
                    ? 'bg-blue-600 border-2 border-white shadow-lg' 
                    : 'bg-red-500 border border-white shadow-md'
                } transform transition-transform hover:scale-110"></div>
                ${isSelected ? `
                  <div class="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                    ${area.name}
                  </div>
                ` : ''}
              </div>
            `,
            className: 'custom-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
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
                <div className="text-center min-w-[150px]">
                  <h3 className="font-semibold text-lg">{area.name}</h3>
                  <p className="text-sm text-gray-600">{area.district} District</p>
                  {area.postalCodes && area.postalCodes.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Postal: {area.postalCodes.slice(0, 3).join(', ')}
                      {area.postalCodes.length > 3 && '...'}
                    </p>
                  )}
                  <button
                    onClick={() => onAreaSelect(area)}
                    className={`mt-2 px-3 py-1 rounded text-sm transition-colors ${
                      isSelected
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
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          onResetView={() => setClickedLocation(null)}
        />
      </MapContainer>

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3 z-[1000]">
        <h4 className="text-sm font-semibold mb-2">Map Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 border border-white"></div>
            <span>Available Areas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white"></div>
            <span>Selected Area</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-300 border border-gray-400" style={{borderStyle: 'dashed'}}></div>
            <span>District Boundaries</span>
          </div>
        </div>
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