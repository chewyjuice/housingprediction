-- Migration: Create areas table
-- Description: Store Singapore area information with geographical boundaries and characteristics

CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    district VARCHAR(100) NOT NULL,
    postal_codes TEXT[] NOT NULL DEFAULT '{}',
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    boundaries JSONB NOT NULL,
    mrt_proximity DECIMAL(5, 2) NOT NULL DEFAULT 0,
    cbd_distance DECIMAL(5, 2) NOT NULL DEFAULT 0,
    amenity_score DECIMAL(3, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_areas_name ON areas USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_areas_district ON areas (district);
CREATE INDEX IF NOT EXISTS idx_areas_postal_codes ON areas USING gin(postal_codes);
CREATE INDEX IF NOT EXISTS idx_areas_coordinates ON areas (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_areas_mrt_proximity ON areas (mrt_proximity);
CREATE INDEX IF NOT EXISTS idx_areas_cbd_distance ON areas (cbd_distance);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_areas_updated_at 
    BEFORE UPDATE ON areas 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE areas ADD CONSTRAINT chk_areas_latitude CHECK (latitude >= 1.0 AND latitude <= 1.5);
ALTER TABLE areas ADD CONSTRAINT chk_areas_longitude CHECK (longitude >= 103.0 AND longitude <= 104.5);
ALTER TABLE areas ADD CONSTRAINT chk_areas_mrt_proximity CHECK (mrt_proximity >= 0);
ALTER TABLE areas ADD CONSTRAINT chk_areas_cbd_distance CHECK (cbd_distance >= 0);
ALTER TABLE areas ADD CONSTRAINT chk_areas_amenity_score CHECK (amenity_score >= 0 AND amenity_score <= 10);