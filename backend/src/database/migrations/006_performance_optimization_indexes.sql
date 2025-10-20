-- Migration: Performance optimization indexes
-- Description: Additional indexes for improved query performance and caching optimization

-- Additional spatial indexes for area searches
CREATE INDEX IF NOT EXISTS idx_areas_spatial_search ON areas USING gist(
    ll_to_earth(latitude, longitude)
);

-- Partial indexes for active/recent data
CREATE INDEX IF NOT EXISTS idx_developments_recent ON developments (area_id, date_announced DESC) 
    WHERE date_announced >= CURRENT_DATE - INTERVAL '2 years';

CREATE INDEX IF NOT EXISTS idx_historical_prices_recent ON historical_prices (area_id, record_date DESC) 
    WHERE record_date >= CURRENT_DATE - INTERVAL '5 years';

CREATE INDEX IF NOT EXISTS idx_prediction_requests_recent ON prediction_requests (area_id, request_date DESC) 
    WHERE request_date >= CURRENT_DATE - INTERVAL '1 year';

-- Covering indexes for frequently accessed columns
CREATE INDEX IF NOT EXISTS idx_areas_search_covering ON areas (district, name) 
    INCLUDE (id, latitude, longitude, mrt_proximity, cbd_distance, amenity_score);

CREATE INDEX IF NOT EXISTS idx_developments_area_covering ON developments (area_id, type) 
    INCLUDE (title, impact_score, date_announced, expected_completion);

CREATE INDEX IF NOT EXISTS idx_historical_prices_area_covering ON historical_prices (area_id, property_type, record_date DESC) 
    INCLUDE (price, price_per_sqft);

-- Indexes for prediction accuracy calculations
CREATE INDEX IF NOT EXISTS idx_prediction_accuracy ON prediction_results (model_accuracy DESC, generated_at DESC) 
    WHERE model_accuracy IS NOT NULL;

-- Composite index for development impact analysis
CREATE INDEX IF NOT EXISTS idx_developments_impact_analysis ON developments (area_id, type, impact_score DESC, date_announced DESC) 
    WHERE impact_score > 0;

-- Index for price trend analysis
CREATE INDEX IF NOT EXISTS idx_price_trends ON historical_prices (area_id, property_type, record_date ASC) 
    WHERE record_date >= CURRENT_DATE - INTERVAL '10 years';

-- Functional indexes for text search optimization
CREATE INDEX IF NOT EXISTS idx_areas_name_lower ON areas (lower(name));
CREATE INDEX IF NOT EXISTS idx_areas_district_lower ON areas (lower(district));

-- Partial index for high-impact developments
CREATE INDEX IF NOT EXISTS idx_developments_high_impact ON developments (area_id, date_announced DESC) 
    WHERE impact_score >= 5.0;

-- Index for cache invalidation queries
CREATE INDEX IF NOT EXISTS idx_developments_cache_invalidation ON developments (area_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_historical_prices_cache_invalidation ON historical_prices (area_id, updated_at DESC);

-- Statistics update for query planner optimization
ANALYZE areas;
ANALYZE developments;
ANALYZE prediction_requests;
ANALYZE prediction_results;
ANALYZE historical_prices;