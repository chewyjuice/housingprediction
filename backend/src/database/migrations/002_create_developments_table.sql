-- Migration: Create developments table
-- Description: Store development information extracted from news sources

CREATE TABLE IF NOT EXISTS developments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('school', 'infrastructure', 'shopping', 'business')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    impact_score DECIMAL(3, 2) NOT NULL DEFAULT 0,
    date_announced DATE NOT NULL,
    expected_completion DATE,
    source_url TEXT NOT NULL,
    source_publisher VARCHAR(255) NOT NULL,
    source_publish_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_developments_area_id ON developments (area_id);
CREATE INDEX IF NOT EXISTS idx_developments_type ON developments (type);
CREATE INDEX IF NOT EXISTS idx_developments_impact_score ON developments (impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_developments_date_announced ON developments (date_announced DESC);
CREATE INDEX IF NOT EXISTS idx_developments_expected_completion ON developments (expected_completion);
CREATE INDEX IF NOT EXISTS idx_developments_source_publisher ON developments (source_publisher);
CREATE INDEX IF NOT EXISTS idx_developments_title ON developments USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_developments_description ON developments USING gin(to_tsvector('english', description));

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_developments_area_type ON developments (area_id, type);
CREATE INDEX IF NOT EXISTS idx_developments_area_date ON developments (area_id, date_announced DESC);
CREATE INDEX IF NOT EXISTS idx_developments_type_impact ON developments (type, impact_score DESC);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_developments_updated_at 
    BEFORE UPDATE ON developments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE developments ADD CONSTRAINT chk_developments_impact_score CHECK (impact_score >= 0 AND impact_score <= 10);
ALTER TABLE developments ADD CONSTRAINT chk_developments_dates CHECK (expected_completion IS NULL OR expected_completion >= date_announced);
ALTER TABLE developments ADD CONSTRAINT chk_developments_source_url CHECK (source_url ~ '^https?://');

-- Unique constraint to prevent duplicate developments
CREATE UNIQUE INDEX IF NOT EXISTS idx_developments_unique 
    ON developments (area_id, title, source_url);