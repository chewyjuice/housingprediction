import { DatabaseConnection } from '../database/connection';
import { BaseRepositoryImpl } from './BaseRepository';
import { AreaEntity, AreaSearchQuery, AreaValidationRequest } from '../types';

export interface IAreaRepository {
  findById(id: string): Promise<AreaEntity | null>;
  findAll(): Promise<AreaEntity[]>;
  create(entity: Omit<AreaEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<AreaEntity>;
  update(id: string, updates: Partial<AreaEntity>): Promise<AreaEntity | null>;
  delete(id: string): Promise<boolean>;
  searchByName(query: string): Promise<AreaEntity[]>;
  searchByQuery(searchQuery: AreaSearchQuery): Promise<AreaEntity[]>;
  findByDistrict(district: string): Promise<AreaEntity[]>;
  findByPostalCode(postalCode: string): Promise<AreaEntity[]>;
  validateCoordinates(coordinates: { latitude: number; longitude: number }): Promise<AreaEntity | null>;
  findNearbyAreas(latitude: number, longitude: number, radiusKm: number): Promise<AreaEntity[]>;
  findByBoundingBox(northEast: { lat: number; lng: number }, southWest: { lat: number; lng: number }): Promise<AreaEntity[]>;
}

export class AreaRepository extends BaseRepositoryImpl<AreaEntity> implements IAreaRepository {
  constructor(db: DatabaseConnection) {
    super(db, 'areas');
  }

  protected mapRowToEntity(row: any): AreaEntity {
    const entity = this.snakeToCamel(row) as AreaEntity;
    
    // Parse JSON fields
    if (typeof entity.boundaries === 'string') {
      entity.boundaries = JSON.parse(entity.boundaries);
    }
    
    // Parse postal codes array if it's a string
    if (typeof entity.postalCodes === 'string') {
      entity.postalCodes = JSON.parse(entity.postalCodes);
    }
    
    return entity;
  }

  public async searchByName(query: string): Promise<AreaEntity[]> {
    // Optimized search using functional indexes and covering indexes
    const searchQuery = `
      SELECT id, name, district, postal_codes, latitude, longitude, boundaries, 
             mrt_proximity, cbd_distance, amenity_score, created_at, updated_at
      FROM ${this.tableName}
      WHERE lower(name) LIKE lower($1) 
         OR to_tsvector('english', name) @@ plainto_tsquery('english', $2)
      ORDER BY 
        CASE 
          WHEN lower(name) = lower($2) THEN 1
          WHEN lower(name) LIKE lower($3) THEN 2
          WHEN name ILIKE $1 THEN 3
          ELSE 4
        END,
        name
      LIMIT 20
    `;
    
    const likePattern = `%${query}%`;
    const exactPattern = query;
    
    const result = await this.executeQuery<AreaEntity>(
      searchQuery, 
      [query, likePattern, exactPattern]
    );
    
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async searchByQuery(searchQuery: AreaSearchQuery): Promise<AreaEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    // Search by name
    if (searchQuery.query) {
      query += ` AND (to_tsvector('english', name) @@ plainto_tsquery('english', $${paramIndex}) OR name ILIKE $${paramIndex + 1})`;
      params.push(searchQuery.query, `%${searchQuery.query}%`);
      paramIndex += 2;
    }

    // Filter by district
    if (searchQuery.district) {
      query += ` AND district = $${paramIndex}`;
      params.push(searchQuery.district);
      paramIndex++;
    }

    // Filter by postal code
    if (searchQuery.postalCode) {
      query += ` AND $${paramIndex} = ANY(postal_codes)`;
      params.push(searchQuery.postalCode);
      paramIndex++;
    }

    query += ` ORDER BY name LIMIT 50`;

    const result = await this.executeQuery<AreaEntity>(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findByDistrict(district: string): Promise<AreaEntity[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE district = $1 ORDER BY name`;
    const result = await this.executeQuery<AreaEntity>(query, [district]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findByPostalCode(postalCode: string): Promise<AreaEntity[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE $1 = ANY(postal_codes) ORDER BY name`;
    const result = await this.executeQuery<AreaEntity>(query, [postalCode]);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async validateCoordinates(coordinates: { latitude: number; longitude: number }): Promise<AreaEntity | null> {
    // First check if coordinates are within Singapore bounds
    if (coordinates.latitude < 1.0 || coordinates.latitude > 1.5 ||
        coordinates.longitude < 103.0 || coordinates.longitude > 104.5) {
      return null;
    }

    // Find area that contains the point using PostGIS-style point-in-polygon check
    // For now, we'll use a simple distance-based approach
    const query = `
      SELECT *, 
        (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians($2)) + sin(radians($1)) * 
        sin(radians(latitude)))) AS distance
      FROM ${this.tableName}
      ORDER BY distance
      LIMIT 1
    `;
    
    const result = await this.executeQuery<AreaEntity & { distance: number }>(
      query, 
      [coordinates.latitude, coordinates.longitude]
    );
    
    if (result.rows.length === 0 || result.rows[0].distance > 2) { // 2km threshold
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  public async findNearbyAreas(latitude: number, longitude: number, radiusKm: number): Promise<AreaEntity[]> {
    const query = `
      SELECT *, 
        (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians($2)) + sin(radians($1)) * 
        sin(radians(latitude)))) AS distance
      FROM ${this.tableName}
      WHERE (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians($2)) + sin(radians($1)) * 
        sin(radians(latitude)))) <= $3
      ORDER BY distance
      LIMIT 50
    `;
    
    const result = await this.executeQuery<AreaEntity & { distance: number }>(
      query, 
      [latitude, longitude, radiusKm]
    );
    
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async findByBoundingBox(
    northEast: { lat: number; lng: number }, 
    southWest: { lat: number; lng: number }
  ): Promise<AreaEntity[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE latitude BETWEEN $1 AND $2
      AND longitude BETWEEN $3 AND $4
      ORDER BY name
    `;
    
    const result = await this.executeQuery<AreaEntity>(
      query, 
      [southWest.lat, northEast.lat, southWest.lng, northEast.lng]
    );
    
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  public async getDistinctDistricts(): Promise<string[]> {
    const query = `SELECT DISTINCT district FROM ${this.tableName} ORDER BY district`;
    const result = await this.executeQuery<{ district: string }>(query);
    return result.rows.map(row => row.district);
  }

  public async getAreasByCharacteristics(
    minMrtProximity?: number,
    maxCbdDistance?: number,
    minAmenityScore?: number
  ): Promise<AreaEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (minMrtProximity !== undefined) {
      query += ` AND mrt_proximity >= $${paramIndex}`;
      params.push(minMrtProximity);
      paramIndex++;
    }

    if (maxCbdDistance !== undefined) {
      query += ` AND cbd_distance <= $${paramIndex}`;
      params.push(maxCbdDistance);
      paramIndex++;
    }

    if (minAmenityScore !== undefined) {
      query += ` AND amenity_score >= $${paramIndex}`;
      params.push(minAmenityScore);
      paramIndex++;
    }

    query += ` ORDER BY amenity_score DESC, mrt_proximity DESC, cbd_distance ASC`;

    const result = await this.executeQuery<AreaEntity>(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }
}