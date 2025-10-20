-- Migration: Create historical_prices table
-- Description: Store historical housing price data for areas

CREATE TABLE IF NOT EXISTS historical_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    price DECIMAL(12, 2) NOT NULL,
    price_per_sqft DECIMAL(8, 2) NOT NULL,
    record_date DATE NOT NULL,
    property_type VARCHAR(20) NOT NULL CHECK (property_type IN ('HDB', 'Condo', 'Landed')),
    source VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_historical_prices_area_id ON historical_prices (area_id);
CREATE INDEX IF NOT EXISTS idx_historical_prices_record_date ON historical_prices (record_date DESC);
CREATE INDEX IF NOT EXISTS idx_historical_prices_property_type ON historical_prices (property_type);
CREATE INDEX IF NOT EXISTS idx_historical_prices_price ON historical_prices (price);
CREATE INDEX IF NOT EXISTS idx_historical_prices_price_per_sqft ON historical_prices (price_per_sqft);
CREATE INDEX IF NOT EXISTS idx_historical_prices_source ON historical_prices (source);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_historical_prices_area_date ON historical_prices (area_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_historical_prices_area_type ON historical_prices (area_id, property_type);
CREATE INDEX IF NOT EXISTS idx_historical_prices_area_type_date ON historical_prices (area_id, property_type, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_historical_prices_type_date ON historical_prices (property_type, record_date DESC);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_historical_prices_updated_at 
    BEFORE UPDATE ON historical_prices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE historical_prices ADD CONSTRAINT chk_historical_prices_price_positive CHECK (price > 0);
ALTER TABLE historical_prices ADD CONSTRAINT chk_historical_prices_price_per_sqft_positive CHECK (price_per_sqft > 0);
ALTER TABLE historical_prices ADD CONSTRAINT chk_historical_prices_record_date CHECK (record_date <= CURRENT_DATE);

-- Unique constraint to prevent duplicate price records
CREATE UNIQUE INDEX IF NOT EXISTS idx_historical_prices_unique 
    ON historical_prices (area_id, record_date, property_type, source);