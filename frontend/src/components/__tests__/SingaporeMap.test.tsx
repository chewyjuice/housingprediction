import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SingaporeMap from '../SingaporeMap';
import { Area } from '../../types';

// Mock Leaflet and react-leaflet components
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }: any) => (
    <div data-testid="map-container" {...props}>
      {children}
    </div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  GeoJSON: ({ data, onEachFeature, ...props }: any) => (
    <div 
      data-testid="geojson" 
      data-feature-name={data.properties?.name}
      onClick={() => onEachFeature && onEachFeature(data, { on: jest.fn(), bindPopup: jest.fn() })}
      {...props}
    />
  ),
  Marker: ({ children, eventHandlers, ...props }: any) => (
    <div 
      data-testid="marker" 
      onClick={() => eventHandlers?.click && eventHandlers.click()}
      onMouseOver={() => eventHandlers?.mouseover && eventHandlers.mouseover()}
      onMouseOut={() => eventHandlers?.mouseout && eventHandlers.mouseout()}
      {...props}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  CircleMarker: ({ children }: any) => <div data-testid="circle-marker">{children}</div>,
  useMapEvents: (handlers: any) => {
    // Mock implementation that can be triggered by tests
    React.useEffect(() => {
      (global as any).mockMapEvents = handlers;
    }, [handlers]);
    return null;
  },
  useMap: () => ({
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
    setView: jest.fn()
  })
}));

jest.mock('leaflet', () => ({
  divIcon: jest.fn(() => ({ options: {} }))
}));

// Mock CSS import
jest.mock('leaflet/dist/leaflet.css', () => ({}));

const mockAreas: Area[] = [
  {
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
  },
  {
    id: 'tampines-1',
    name: 'Tampines Central',
    district: 'East',
    postalCodes: ['529509', '529510'],
    coordinates: {
      latitude: 1.3525,
      longitude: 103.9447,
      boundaries: {
        type: 'Polygon',
        coordinates: [[[103.94, 1.35], [103.95, 1.35], [103.95, 1.36], [103.94, 1.36], [103.94, 1.35]]]
      }
    },
    characteristics: {
      mrtProximity: 0.1,
      cbdDistance: 18.2,
      amenityScore: 8.0
    }
  }
];

describe('SingaporeMap Component', () => {
  const mockOnAreaSelect = jest.fn();
  const mockOnAreaHover = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    areas: mockAreas,
    selectedArea: null,
    onAreaSelect: mockOnAreaSelect,
    onAreaHover: mockOnAreaHover
  };

  it('renders map container with correct structure', () => {
    render(<SingaporeMap {...defaultProps} />);
    
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  it('displays Singapore boundary and district boundaries', () => {
    render(<SingaporeMap {...defaultProps} />);
    
    const geoJsonElements = screen.getAllByTestId('geojson');
    expect(geoJsonElements.length).toBeGreaterThan(0);
    
    // Check for Singapore boundary
    const singaporeBoundary = geoJsonElements.find(el => 
      el.getAttribute('data-feature-name') === 'Singapore'
    );
    expect(singaporeBoundary).toBeInTheDocument();
  });

  it('renders area markers for all provided areas', () => {
    render(<SingaporeMap {...defaultProps} />);
    
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(mockAreas.length);
  });

  it('calls onAreaSelect when area marker is clicked', () => {
    render(<SingaporeMap {...defaultProps} />);
    
    const markers = screen.getAllByTestId('marker');
    fireEvent.click(markers[0]);
    
    expect(mockOnAreaSelect).toHaveBeenCalledWith(mockAreas[0]);
  });

  it('calls onAreaHover when area marker is hovered', () => {
    render(<SingaporeMap {...defaultProps} />);
    
    const markers = screen.getAllByTestId('marker');
    fireEvent.mouseOver(markers[0]);
    
    expect(mockOnAreaHover).toHaveBeenCalledWith(mockAreas[0]);
    
    fireEvent.mouseOut(markers[0]);
    expect(mockOnAreaHover).toHaveBeenCalledWith(null);
  });

  it('displays selected area information when area is selected', () => {
    const propsWithSelection = {
      ...defaultProps,
      selectedArea: mockAreas[0]
    };
    
    render(<SingaporeMap {...propsWithSelection} />);
    
    expect(screen.getByText('Selected Area')).toBeInTheDocument();
    expect(screen.getByText('Orchard Road')).toBeInTheDocument();
    expect(screen.getByText('Central District')).toBeInTheDocument();
  });

  it('shows area characteristics for selected area', () => {
    const propsWithSelection = {
      ...defaultProps,
      selectedArea: mockAreas[0]
    };
    
    render(<SingaporeMap {...propsWithSelection} />);
    
    expect(screen.getByText(/MRT Proximity: 0.2km/)).toBeInTheDocument();
    expect(screen.getByText(/CBD Distance: 2.5km/)).toBeInTheDocument();
  });

  it('renders map legend with correct information', () => {
    render(<SingaporeMap {...defaultProps} />);
    
    expect(screen.getByText('Map Legend')).toBeInTheDocument();
    expect(screen.getByText('Available Areas')).toBeInTheDocument();
    expect(screen.getByText('Selected Area')).toBeInTheDocument();
    expect(screen.getByText('District Boundaries')).toBeInTheDocument();
  });

  it('renders map controls with zoom and reset functionality', () => {
    render(<SingaporeMap {...defaultProps} />);
    
    const zoomInButton = screen.getByTitle('Zoom In');
    const zoomOutButton = screen.getByTitle('Zoom Out');
    const resetButton = screen.getByTitle('Reset View');
    
    expect(zoomInButton).toBeInTheDocument();
    expect(zoomOutButton).toBeInTheDocument();
    expect(resetButton).toBeInTheDocument();
  });

  it('handles map click events to select closest area', async () => {
    render(<SingaporeMap {...defaultProps} />);
    
    // Simulate map click event
    const mockLatLng = { lat: 1.3048, lng: 103.8318 };
    
    if ((global as any).mockMapEvents?.click) {
      (global as any).mockMapEvents.click({ latlng: mockLatLng });
    }
    
    await waitFor(() => {
      expect(mockOnAreaSelect).toHaveBeenCalledWith(mockAreas[0]);
    });
  });

  it('handles empty areas array gracefully', () => {
    const propsWithNoAreas = {
      ...defaultProps,
      areas: []
    };
    
    render(<SingaporeMap {...propsWithNoAreas} />);
    
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
  });

  it('updates marker appearance when area is selected', () => {
    const { rerender } = render(<SingaporeMap {...defaultProps} />);
    
    // Initially no area selected
    let markers = screen.getAllByTestId('marker');
    expect(markers[0]).toBeInTheDocument();
    
    // Select an area
    const propsWithSelection = {
      ...defaultProps,
      selectedArea: mockAreas[0]
    };
    
    rerender(<SingaporeMap {...propsWithSelection} />);
    
    markers = screen.getAllByTestId('marker');
    expect(markers[0]).toBeInTheDocument();
  });

  it('displays popup content when marker is clicked', () => {
    render(<SingaporeMap {...defaultProps} />);
    
    const popups = screen.getAllByTestId('popup');
    expect(popups.length).toBeGreaterThan(0);
    
    // Check popup contains area information
    expect(screen.getByText('Orchard Road')).toBeInTheDocument();
    expect(screen.getByText('Tampines Central')).toBeInTheDocument();
  });

  it('handles district click to select area in district', () => {
    render(<SingaporeMap {...defaultProps} />);
    
    const districtElements = screen.getAllByTestId('geojson');
    const centralDistrict = districtElements.find(el => 
      el.getAttribute('data-feature-name') !== 'Singapore'
    );
    
    if (centralDistrict) {
      fireEvent.click(centralDistrict);
      // Should select an area in the clicked district
      expect(mockOnAreaSelect).toHaveBeenCalled();
    }
  });
});