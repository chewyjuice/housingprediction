import { Request, Response } from 'express';
import { fileStorage } from '../database/fileStorage';
import { singaporeAreas } from '../data/singapore-areas';
import { Area } from '../types';

export class SimpleAreaController {
  
  public async getOrInitializeAreas(): Promise<Area[]> {
    let areas = await fileStorage.readData<Area>('areas');
    // Check if areas need transformation (missing id field or old structure)
    const needsTransformation = areas.length === 0 || !areas[0]?.id || !areas[0]?.coordinates?.latitude;
    if (needsTransformation) {
      console.log('Transforming singapore areas data...');
      // Transform the backend data structure to match the frontend Area interface
      const transformedAreas: Area[] = singaporeAreas.map((area, index) => {
        const transformed = {
          id: area.name.toLowerCase().replace(/\s+/g, '-'),
          name: area.name,
          district: area.district,
          postalCodes: area.postalCodes,
          coordinates: {
            latitude: area.latitude,
            longitude: area.longitude,
            boundaries: area.boundaries
          },
          characteristics: {
            mrtProximity: area.mrtProximity,
            cbdDistance: area.cbdDistance,
            amenityScore: area.amenityScore
          }
        };
        console.log(`Transforming area ${index}: ${area.name} -> id: ${transformed.id}`);
        return transformed;
      });
      console.log('Transformed areas sample:', JSON.stringify(transformedAreas[0], null, 2));
      console.log('About to save transformed areas...');
      await fileStorage.writeData('areas', transformedAreas);
      console.log('Areas saved successfully');
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
}