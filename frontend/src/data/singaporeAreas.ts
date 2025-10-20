import { Area } from '../types';

// Sample Singapore areas with realistic data
export const singaporeAreas: Area[] = [
  // Central District
  {
    id: 'orchard',
    name: 'Orchard',
    district: 'Central',
    postalCodes: ['238801', '238802', '238803'],
    coordinates: {
      latitude: 1.3048,
      longitude: 103.8318,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.825, 1.300],
          [103.840, 1.300],
          [103.840, 1.310],
          [103.825, 1.310],
          [103.825, 1.300]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 0.2,
      cbdDistance: 2.5,
      amenityScore: 9.5
    }
  },
  {
    id: 'marina-bay',
    name: 'Marina Bay',
    district: 'Central',
    postalCodes: ['018956', '018957', '018958'],
    coordinates: {
      latitude: 1.2966,
      longitude: 103.8547,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.850, 1.290],
          [103.865, 1.290],
          [103.865, 1.305],
          [103.850, 1.305],
          [103.850, 1.290]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 0.3,
      cbdDistance: 0.5,
      amenityScore: 9.8
    }
  },
  {
    id: 'raffles-place',
    name: 'Raffles Place',
    district: 'Central',
    postalCodes: ['048616', '048617', '048618'],
    coordinates: {
      latitude: 1.2837,
      longitude: 103.8511,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.845, 1.280],
          [103.860, 1.280],
          [103.860, 1.290],
          [103.845, 1.290],
          [103.845, 1.280]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 0.1,
      cbdDistance: 0.0,
      amenityScore: 9.2
    }
  },

  // East District
  {
    id: 'tampines',
    name: 'Tampines',
    district: 'East',
    postalCodes: ['520201', '520202', '520203'],
    coordinates: {
      latitude: 1.3496,
      longitude: 103.9568,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.950, 1.345],
          [103.965, 1.345],
          [103.965, 1.355],
          [103.950, 1.355],
          [103.950, 1.345]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 0.5,
      cbdDistance: 18.2,
      amenityScore: 8.5
    }
  },
  {
    id: 'bedok',
    name: 'Bedok',
    district: 'East',
    postalCodes: ['460121', '460122', '460123'],
    coordinates: {
      latitude: 1.3236,
      longitude: 103.9273,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.920, 1.318],
          [103.935, 1.318],
          [103.935, 1.328],
          [103.920, 1.328],
          [103.920, 1.318]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 0.8,
      cbdDistance: 15.5,
      amenityScore: 7.8
    }
  },
  {
    id: 'pasir-ris',
    name: 'Pasir Ris',
    district: 'East',
    postalCodes: ['510518', '510519', '510520'],
    coordinates: {
      latitude: 1.3721,
      longitude: 103.9474,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.940, 1.365],
          [103.955, 1.365],
          [103.955, 1.380],
          [103.940, 1.380],
          [103.940, 1.365]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 1.2,
      cbdDistance: 22.8,
      amenityScore: 7.2
    }
  },

  // West District
  {
    id: 'jurong-east',
    name: 'Jurong East',
    district: 'West',
    postalCodes: ['600201', '600202', '600203'],
    coordinates: {
      latitude: 1.3329,
      longitude: 103.7436,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.735, 1.325],
          [103.750, 1.325],
          [103.750, 1.340],
          [103.735, 1.340],
          [103.735, 1.325]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 0.4,
      cbdDistance: 24.5,
      amenityScore: 8.2
    }
  },
  {
    id: 'clementi',
    name: 'Clementi',
    district: 'West',
    postalCodes: ['120401', '120402', '120403'],
    coordinates: {
      latitude: 1.3162,
      longitude: 103.7649,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.755, 1.310],
          [103.775, 1.310],
          [103.775, 1.325],
          [103.755, 1.325],
          [103.755, 1.310]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 0.6,
      cbdDistance: 18.7,
      amenityScore: 7.9
    }
  },

  // North District
  {
    id: 'woodlands',
    name: 'Woodlands',
    district: 'North',
    postalCodes: ['730888', '730889', '730890'],
    coordinates: {
      latitude: 1.4382,
      longitude: 103.7890,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.780, 1.430],
          [103.800, 1.430],
          [103.800, 1.445],
          [103.780, 1.445],
          [103.780, 1.430]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 0.7,
      cbdDistance: 28.3,
      amenityScore: 7.5
    }
  },
  {
    id: 'yishun',
    name: 'Yishun',
    district: 'North',
    postalCodes: ['760101', '760102', '760103'],
    coordinates: {
      latitude: 1.4304,
      longitude: 103.8354,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.825, 1.425],
          [103.845, 1.425],
          [103.845, 1.440],
          [103.825, 1.440],
          [103.825, 1.425]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 0.9,
      cbdDistance: 25.1,
      amenityScore: 7.3
    }
  },

  // South District
  {
    id: 'harbourfront',
    name: 'HarbourFront',
    district: 'South',
    postalCodes: ['099253', '099254', '099255'],
    coordinates: {
      latitude: 1.2653,
      longitude: 103.8223,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.815, 1.260],
          [103.830, 1.260],
          [103.830, 1.270],
          [103.815, 1.270],
          [103.815, 1.260]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 0.3,
      cbdDistance: 4.2,
      amenityScore: 8.7
    }
  },
  {
    id: 'tiong-bahru',
    name: 'Tiong Bahru',
    district: 'South',
    postalCodes: ['160001', '160002', '160003'],
    coordinates: {
      latitude: 1.2857,
      longitude: 103.8268,
      boundaries: {
        type: 'Polygon',
        coordinates: [[
          [103.820, 1.280],
          [103.835, 1.280],
          [103.835, 1.290],
          [103.820, 1.290],
          [103.820, 1.280]
        ]]
      }
    },
    characteristics: {
      mrtProximity: 0.4,
      cbdDistance: 3.8,
      amenityScore: 8.4
    }
  }
];

// Helper functions for area data
export const getAreasByDistrict = (district: string): Area[] => {
  return singaporeAreas.filter(area => 
    area.district.toLowerCase() === district.toLowerCase()
  );
};

export const getAreaById = (id: string): Area | undefined => {
  return singaporeAreas.find(area => area.id === id);
};

export const searchAreas = (query: string): Area[] => {
  const searchTerm = query.toLowerCase();
  return singaporeAreas.filter(area =>
    area.name.toLowerCase().includes(searchTerm) ||
    area.district.toLowerCase().includes(searchTerm) ||
    area.postalCodes.some(code => code.includes(searchTerm))
  );
};

export const validateAreaCoordinates = (lat: number, lng: number): boolean => {
  // Singapore boundaries (approximate)
  const minLat = 1.16;
  const maxLat = 1.48;
  const minLng = 103.6;
  const maxLng = 104.1;
  
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
};

export default singaporeAreas;