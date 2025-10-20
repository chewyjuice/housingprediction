import { DatabaseConnection } from '../database/connection';
import { AreaRepository } from '../repositories/AreaRepository';
import { singaporeAreas, SingaporeAreaData } from '../data/singapore-areas';
import { AreaEntity } from '../types';

export class AreaSeedingService {
  private areaRepository: AreaRepository;

  constructor(db: DatabaseConnection) {
    this.areaRepository = new AreaRepository(db);
  }

  /**
   * Seeds the database with Singapore area data
   * @param overwrite - If true, will update existing areas with new data
   */
  public async seedAreas(overwrite: boolean = false): Promise<void> {
    console.log('Starting Singapore area seeding...');
    
    try {
      let seededCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const areaData of singaporeAreas) {
        const existingArea = await this.findExistingArea(areaData);
        
        if (existingArea && !overwrite) {
          console.log(`Skipping existing area: ${areaData.name}`);
          skippedCount++;
          continue;
        }

        const areaEntity = this.mapToAreaEntity(areaData);

        if (existingArea && overwrite) {
          await this.areaRepository.update(existingArea.id, areaEntity);
          console.log(`Updated area: ${areaData.name}`);
          updatedCount++;
        } else {
          await this.areaRepository.create(areaEntity);
          console.log(`Created area: ${areaData.name}`);
          seededCount++;
        }
      }

      console.log(`Area seeding completed:`);
      console.log(`- Created: ${seededCount} areas`);
      console.log(`- Updated: ${updatedCount} areas`);
      console.log(`- Skipped: ${skippedCount} areas`);
      console.log(`- Total processed: ${singaporeAreas.length} areas`);

    } catch (error) {
      console.error('Error during area seeding:', error);
      throw error;
    }
  }

  /**
   * Validates that all seeded areas are properly stored
   */
  public async validateSeededData(): Promise<boolean> {
    try {
      const allAreas = await this.areaRepository.findAll();
      const seededAreaNames = singaporeAreas.map(area => area.name);
      
      console.log(`Validating ${seededAreaNames.length} expected areas...`);
      
      let validationErrors = 0;
      
      for (const expectedAreaName of seededAreaNames) {
        const foundArea = allAreas.find(area => area.name === expectedAreaName);
        
        if (!foundArea) {
          console.error(`Missing area: ${expectedAreaName}`);
          validationErrors++;
          continue;
        }

        // Validate coordinates are within Singapore bounds
        if (foundArea.latitude < 1.0 || foundArea.latitude > 1.5 ||
            foundArea.longitude < 103.0 || foundArea.longitude > 104.5) {
          console.error(`Invalid coordinates for area: ${expectedAreaName}`);
          validationErrors++;
        }

        // Validate postal codes exist
        if (!foundArea.postalCodes || foundArea.postalCodes.length === 0) {
          console.error(`Missing postal codes for area: ${expectedAreaName}`);
          validationErrors++;
        }
      }

      if (validationErrors === 0) {
        console.log('✅ All seeded areas validated successfully');
        return true;
      } else {
        console.error(`❌ Validation failed with ${validationErrors} errors`);
        return false;
      }

    } catch (error) {
      console.error('Error during validation:', error);
      return false;
    }
  }

  /**
   * Gets statistics about the seeded area data
   */
  public async getAreaStatistics(): Promise<{
    totalAreas: number;
    districtCount: number;
    districts: string[];
    averageMrtProximity: number;
    averageCbdDistance: number;
    averageAmenityScore: number;
  }> {
    const allAreas = await this.areaRepository.findAll();
    const districts = await this.areaRepository.getDistinctDistricts();
    
    const totalMrtProximity = allAreas.reduce((sum, area) => sum + area.mrtProximity, 0);
    const totalCbdDistance = allAreas.reduce((sum, area) => sum + area.cbdDistance, 0);
    const totalAmenityScore = allAreas.reduce((sum, area) => sum + area.amenityScore, 0);
    
    return {
      totalAreas: allAreas.length,
      districtCount: districts.length,
      districts: districts.sort(),
      averageMrtProximity: totalMrtProximity / allAreas.length,
      averageCbdDistance: totalCbdDistance / allAreas.length,
      averageAmenityScore: totalAmenityScore / allAreas.length
    };
  }

  /**
   * Finds an existing area by name and district
   */
  private async findExistingArea(areaData: SingaporeAreaData): Promise<AreaEntity | null> {
    const areas = await this.areaRepository.searchByName(areaData.name);
    return areas.find(area => 
      area.name === areaData.name && 
      area.district === areaData.district
    ) || null;
  }

  /**
   * Maps Singapore area data to database entity format
   */
  private mapToAreaEntity(areaData: SingaporeAreaData): Omit<AreaEntity, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      name: areaData.name,
      district: areaData.district,
      postalCodes: areaData.postalCodes,
      latitude: areaData.latitude,
      longitude: areaData.longitude,
      boundaries: JSON.stringify(areaData.boundaries),
      mrtProximity: areaData.mrtProximity,
      cbdDistance: areaData.cbdDistance,
      amenityScore: areaData.amenityScore,
      characteristics: {
        mrtProximity: areaData.mrtProximity,
        cbdDistance: areaData.cbdDistance,
        amenityScore: areaData.amenityScore
      }
    };
  }

  /**
   * Clears all area data from the database (use with caution)
   */
  public async clearAllAreas(): Promise<void> {
    console.log('⚠️  Clearing all area data...');
    
    const allAreas = await this.areaRepository.findAll();
    let deletedCount = 0;
    
    for (const area of allAreas) {
      await this.areaRepository.delete(area.id);
      deletedCount++;
    }
    
    console.log(`Deleted ${deletedCount} areas from database`);
  }
}