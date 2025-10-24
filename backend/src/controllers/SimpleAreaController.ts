import { Request, Response } from 'express';
import { fileStorage } from '../database/fileStorage';
import { Area } from '../types';

export class SimpleAreaController {
  
  public async getOrInitializeAreas(): Promise<Area[]> {
    let areas = await fileStorage.readData<Area>('areas');
    console.log(`[AREAS] Loaded ${areas.length} areas from storage`);
    // Check if areas need transformation (missing id field, old structure, or wrong count)
    const needsTransformation = areas.length === 0 || areas.length !== 28 || !areas[0]?.id || !areas[0]?.coordinates?.latitude || !areas.some(a => a.id === 'pasir-ris');
    if (needsTransformation) {
      console.log('Initializing comprehensive Singapore districts data...');
      
      // Use the same comprehensive district list as the frontend
      const comprehensiveDistricts = [
        // Central Districts (D01-D08)
        { district: 'District 1', uraCode: 'D01', planningArea: 'Marina Bay', areaId: 'marina-bay' },
        { district: 'District 2', uraCode: 'D02', planningArea: 'Raffles Place', areaId: 'raffles-place' },
        { district: 'District 3', uraCode: 'D03', planningArea: 'Tiong Bahru', areaId: 'tiong-bahru' },
        { district: 'District 4', uraCode: 'D04', planningArea: 'Harbourfront', areaId: 'harbourfront' },
        { district: 'District 5', uraCode: 'D05', planningArea: 'Buona Vista', areaId: 'buona-vista' },
        { district: 'District 6', uraCode: 'D06', planningArea: 'City Hall', areaId: 'city-hall' },
        { district: 'District 7', uraCode: 'D07', planningArea: 'Beach Road', areaId: 'beach-road' },
        { district: 'District 8', uraCode: 'D08', planningArea: 'Little India', areaId: 'little-india' },
        
        // Prime Districts (D09-D15)
        { district: 'District 9', uraCode: 'D09', planningArea: 'Orchard', areaId: 'orchard' },
        { district: 'District 10', uraCode: 'D10', planningArea: 'Tanglin', areaId: 'tanglin' },
        { district: 'District 11', uraCode: 'D11', planningArea: 'Newton', areaId: 'newton' },
        { district: 'District 12', uraCode: 'D12', planningArea: 'Novena', areaId: 'novena' },
        { district: 'District 13', uraCode: 'D13', planningArea: 'Potong Pasir', areaId: 'potong-pasir' },
        { district: 'District 14', uraCode: 'D14', planningArea: 'Geylang', areaId: 'geylang' },
        { district: 'District 15', uraCode: 'D15', planningArea: 'Marine Parade', areaId: 'marine-parade' },
        
        // Mature Districts (D16-D20)
        { district: 'District 16', uraCode: 'D16', planningArea: 'Bedok', areaId: 'bedok' },
        { district: 'District 17', uraCode: 'D17', planningArea: 'Changi', areaId: 'changi' },
        { district: 'District 18', uraCode: 'D18', planningArea: 'Pasir Ris', areaId: 'pasir-ris' },
        { district: 'District 19', uraCode: 'D19', planningArea: 'Tampines', areaId: 'tampines' },
        { district: 'District 20', uraCode: 'D20', planningArea: 'Bishan', areaId: 'bishan' },
        
        // Outer Districts (D21-D28)
        { district: 'District 21', uraCode: 'D21', planningArea: 'Clementi', areaId: 'clementi' },
        { district: 'District 22', uraCode: 'D22', planningArea: 'Jurong East', areaId: 'jurong-east' },
        { district: 'District 23', uraCode: 'D23', planningArea: 'Bukit Batok', areaId: 'bukit-batok' },
        { district: 'District 24', uraCode: 'D24', planningArea: 'Kranji', areaId: 'kranji' },
        { district: 'District 25', uraCode: 'D25', planningArea: 'Woodlands', areaId: 'woodlands' },
        { district: 'District 26', uraCode: 'D26', planningArea: 'Yishun', areaId: 'yishun' },
        { district: 'District 27', uraCode: 'D27', planningArea: 'Sembawang', areaId: 'sembawang' },
        { district: 'District 28', uraCode: 'D28', planningArea: 'Seletar', areaId: 'seletar' }
      ];

      // Transform to Area format
      const transformedAreas: Area[] = comprehensiveDistricts.map((district) => ({
        id: district.areaId,
        name: `${district.district} (${district.planningArea})`,
        district: district.district,
        planningArea: district.planningArea,
        uraCode: district.uraCode,
        subDistricts: [],
        postalCodes: [],
        coordinates: {
          latitude: this.getDistrictCoordinates(district.uraCode).latitude,
          longitude: this.getDistrictCoordinates(district.uraCode).longitude,
          boundaries: this.getDistrictBoundaries(district.uraCode)
        },
        characteristics: {
          mrtProximity: 0.5,
          cbdDistance: this.getDistrictCBDDistance(district.uraCode),
          amenityScore: this.getDistrictAmenityScore(district.planningArea)
        },
        enhancedInfo: {
          uraCode: district.uraCode,
          planningArea: district.planningArea,
          subDistricts: []
        }
      }));

      console.log(`[AREAS] Initialized ${transformedAreas.length} comprehensive Singapore districts`);
      console.log(`[AREAS] Sample area IDs:`, transformedAreas.slice(0, 5).map(a => a.id));
      console.log(`[AREAS] Pasir Ris included:`, transformedAreas.some(a => a.id === 'pasir-ris'));
      await fileStorage.writeData('areas', transformedAreas);
      areas = transformedAreas;
    }
    return areas;
  }
  
  /**
   * GET /api/areas/search - Search areas by query parameters
   */
  public searchAreas = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('SearchAreas called with query:', req.query);
      const { query, district, postalCode } = req.query;
      
      // Initialize areas data if not exists
      const areas = await this.getOrInitializeAreas();
      console.log('Areas loaded, first area structure:', JSON.stringify(areas[0], null, 2));

      let filteredAreas = areas;

      // Filter by query (name or district)
      if (query && typeof query === 'string') {
        const searchTerm = query.toLowerCase();
        filteredAreas = filteredAreas.filter(area => 
          area.name.toLowerCase().includes(searchTerm) ||
          area.district.toLowerCase().includes(searchTerm)
        );
      }

      // Filter by district
      if (district && typeof district === 'string') {
        filteredAreas = filteredAreas.filter(area => 
          area.district.toLowerCase() === district.toLowerCase()
        );
      }

      // Filter by postal code
      if (postalCode && typeof postalCode === 'string') {
        filteredAreas = filteredAreas.filter(area => 
          area.postalCodes.some(code => code.includes(postalCode))
        );
      }

      console.log('Returning filtered areas sample:', JSON.stringify(filteredAreas[0], null, 2));
      res.json({
        success: true,
        data: filteredAreas,
        count: filteredAreas.length
      });

    } catch (error) {
      console.error('Error searching areas:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * GET /api/areas/:id - Get specific area by ID
   */
  public getAreaById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Area ID is required'
        });
        return;
      }

      // Initialize areas data if not exists
      const areas = await this.getOrInitializeAreas();

      const area = areas.find(a => a.id === id);

      if (!area) {
        res.status(404).json({
          success: false,
          error: 'Area not found'
        });
        return;
      }

      res.json({
        success: true,
        data: area
      });

    } catch (error) {
      console.error('Error getting area by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * GET /api/areas/districts - Get all available districts
   */
  public getDistricts = async (req: Request, res: Response): Promise<void> => {
    try {
      // Initialize areas data if not exists
      const areas = await this.getOrInitializeAreas();

      const districts = [...new Set(areas.map(area => area.district))].sort();

      res.json({
        success: true,
        data: districts,
        count: districts.length
      });

    } catch (error) {
      console.error('Error getting districts:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * GET /api/areas/nearby - Find areas near coordinates
   */
  public getNearbyAreas = async (req: Request, res: Response): Promise<void> => {
    try {
      const { lat, lng, radius = 5 } = req.query;

      if (!lat || !lng) {
        res.status(400).json({
          success: false,
          error: 'Latitude and longitude are required'
        });
        return;
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const searchRadius = parseFloat(radius as string);

      if (isNaN(latitude) || isNaN(longitude) || isNaN(searchRadius)) {
        res.status(400).json({
          success: false,
          error: 'Invalid coordinates or radius'
        });
        return;
      }

      // Initialize areas data if not exists
      const areas = await this.getOrInitializeAreas();

      // Simple distance calculation (not precise, but good for demo)
      const nearbyAreas = areas.filter(area => {
        const distance = Math.sqrt(
          Math.pow(area.coordinates.latitude - latitude, 2) +
          Math.pow(area.coordinates.longitude - longitude, 2)
        ) * 111; // Rough conversion to km

        return distance <= searchRadius;
      });

      res.json({
        success: true,
        data: nearbyAreas,
        count: nearbyAreas.length
      });

    } catch (error) {
      console.error('Error finding nearby areas:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * POST /api/areas/validate - Validate coordinates and find containing area
   */
  public validateCoordinates = async (req: Request, res: Response): Promise<void> => {
    try {
      const { coordinates } = req.body;

      if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
        res.status(400).json({
          success: false,
          error: 'Valid coordinates are required'
        });
        return;
      }

      const { latitude, longitude } = coordinates;

      // Initialize areas data if not exists
      const areas = await this.getOrInitializeAreas();

      // Find the closest area (simple implementation)
      let closestArea: Area | null = null;
      let minDistance = Infinity;

      areas.forEach(area => {
        const distance = Math.sqrt(
          Math.pow(area.coordinates.latitude - latitude, 2) +
          Math.pow(area.coordinates.longitude - longitude, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestArea = area;
        }
      });

      if (closestArea && minDistance < 0.05) { // Within reasonable distance
        res.json({
          success: true,
          data: closestArea
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'No area found for the given coordinates'
        });
      }

    } catch (error) {
      console.error('Error validating coordinates:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Helper methods for district data
  private getDistrictCoordinates(uraCode: string): { latitude: number, longitude: number } {
    const districtCoordinates: { [key: string]: { latitude: number, longitude: number } } = {
      'D01': { latitude: 1.2844, longitude: 103.8517 }, // Marina Bay
      'D02': { latitude: 1.2820, longitude: 103.8607 }, // Raffles Place
      'D03': { latitude: 1.2780, longitude: 103.8340 }, // Tiong Bahru
      'D04': { latitude: 1.2650, longitude: 103.8200 }, // Harbourfront
      'D05': { latitude: 1.3070, longitude: 103.7900 }, // Buona Vista
      'D06': { latitude: 1.2930, longitude: 103.8520 }, // City Hall
      'D07': { latitude: 1.2980, longitude: 103.8580 }, // Beach Road
      'D08': { latitude: 1.3070, longitude: 103.8520 }, // Little India
      'D09': { latitude: 1.3048, longitude: 103.8318 }, // Orchard
      'D10': { latitude: 1.3200, longitude: 103.8240 }, // Tanglin
      'D11': { latitude: 1.3180, longitude: 103.8380 }, // Newton
      'D12': { latitude: 1.3270, longitude: 103.8430 }, // Novena
      'D13': { latitude: 1.3290, longitude: 103.8670 }, // Potong Pasir
      'D14': { latitude: 1.3140, longitude: 103.8790 }, // Geylang
      'D15': { latitude: 1.3020, longitude: 103.9060 }, // Marine Parade
      'D16': { latitude: 1.3240, longitude: 103.9300 }, // Bedok
      'D17': { latitude: 1.3570, longitude: 103.9870 }, // Changi
      'D18': { latitude: 1.3720, longitude: 103.9490 }, // Pasir Ris
      'D19': { latitude: 1.3530, longitude: 103.9450 }, // Tampines
      'D20': { latitude: 1.3510, longitude: 103.8480 }, // Bishan
      'D21': { latitude: 1.3150, longitude: 103.7650 }, // Clementi
      'D22': { latitude: 1.3330, longitude: 103.7420 }, // Jurong East
      'D23': { latitude: 1.3480, longitude: 103.7580 }, // Bukit Batok
      'D24': { latitude: 1.4270, longitude: 103.7550 }, // Kranji
      'D25': { latitude: 1.4370, longitude: 103.7860 }, // Woodlands
      'D26': { latitude: 1.4290, longitude: 103.8350 }, // Yishun
      'D27': { latitude: 1.4490, longitude: 103.8200 }, // Sembawang
      'D28': { latitude: 1.4040, longitude: 103.8690 }  // Seletar
    };
    return districtCoordinates[uraCode] || { latitude: 1.3521, longitude: 103.8198 };
  }

  private getDistrictBoundaries(uraCode: string): any {
    // Simplified boundaries - in a real implementation, these would be proper polygon coordinates
    return {
      type: 'Polygon',
      coordinates: [[[103.8, 1.25], [103.9, 1.25], [103.9, 1.35], [103.8, 1.35], [103.8, 1.25]]]
    };
  }

  private getDistrictCBDDistance(uraCode: string): number {
    const districtNum = parseInt(uraCode.substring(1));
    if (districtNum <= 8) return Math.random() * 2; // Central districts
    if (districtNum <= 15) return 2 + Math.random() * 3; // Prime districts
    if (districtNum <= 20) return 5 + Math.random() * 5; // Mature districts
    return 10 + Math.random() * 10; // Outer districts
  }

  private getDistrictAmenityScore(planningArea: string): number {
    const premiumAreas = ['Marina Bay', 'Orchard', 'Raffles Place'];
    const goodAreas = ['Tiong Bahru', 'Newton', 'Novena', 'Bishan'];
    
    if (premiumAreas.includes(planningArea)) return 8.5 + Math.random() * 1.5;
    if (goodAreas.includes(planningArea)) return 7.0 + Math.random() * 1.5;
    return 5.5 + Math.random() * 2.0;
  }
}