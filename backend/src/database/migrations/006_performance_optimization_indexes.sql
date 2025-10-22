-- Migration: Performance optimization indexes
-- Description: Additional indexes for improved query performance and caching optimization

-- Enable required extensions for advanced indexing
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Additional spatial indexes for area searches (using built-in functions)
CREATE INDEX IF NOT EXISTS idx_areas_spatial_search ON areas USING gist(
    point(longitude, latitude)
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

-- Trigram indexes for fuzzy text search
CREATE INDEX IF NOT EXISTS idx_areas_name_trgm ON areas USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_developments_title_trgm ON developments USING gin(title gin_trgm_ops);

-- Partial index for high-impact developments
CREATE INDEX IF NOT EXISTS idx_developments_high_impact ON developments (area_id, date_announced DESC) 
    WHERE impact_score >= 5.0;

-- Index for cache invalidation queries
CREATE INDEX IF NOT EXISTS idx_developments_cache_invalidation ON developments (area_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_historical_prices_cache_invalidation ON historical_prices (area_id, updated_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_prediction_workflow ON prediction_requests (area_id, timeframe_years, request_date DESC);
CREATE INDEX IF NOT EXISTS idx_development_timeline ON developments (area_id, date_announced DESC, expected_completion ASC);
CREATE INDEX IF NOT EXISTS idx_price_analysis ON historical_prices (area_id, property_type, record_date DESC, price);

-- Partial indexes for performance-critical queries
CREATE INDEX IF NOT EXISTS idx_recent_predictions ON prediction_requests (area_id, request_date DESC) 
    WHERE request_date >= CURRENT_DATE - INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_active_developments ON developments (area_id, type, impact_score DESC) 
    WHERE expected_completion IS NULL OR expected_completion >= CURRENT_DATE;

-- Indexes for aggregation queries
CREATE INDEX IF NOT EXISTS idx_developments_aggregation ON developments (area_id, type, impact_score) 
    WHERE impact_score > 0;

CREATE INDEX IF NOT EXISTS idx_price_aggregation ON historical_prices (area_id, property_type, record_date) 
    WHERE record_date >= CURRENT_DATE - INTERVAL '5 years';

-- Database configuration optimizations
-- Set work_mem for complex queries
ALTER SYSTEM SET work_mem = '256MB';

-- Set effective_cache_size (should be ~75% of available RAM)
ALTER SYSTEM SET effective_cache_size = '2GB';

-- Set random_page_cost for SSD storage
ALTER SYSTEM SET random_page_cost = 1.1;

-- Set checkpoint settings for better write performance
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';

-- Enable query plan caching
ALTER SYSTEM SET plan_cache_mode = 'auto';

-- Reload configuration
SELECT pg_reload_conf();

-- Update table statistics for query planner optimization
ANALYZE areas;
ANALYZE developments;
ANALYZE prediction_requests;
ANALYZE prediction_results;
ANALYZE historical_prices;

-- Create materialized view for frequently accessed area statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS area_statistics AS
SELECT 
    a.id,
    a.name,
    a.district,
    COUNT(d.id) as development_count,
    AVG(d.impact_score) as avg_impact_score,
    COUNT(CASE WHEN d.date_announced >= CURRENT_DATE - INTERVAL '1 year' THEN 1 END) as recent_developments,
    COUNT(hp.id) as price_records,
    AVG(hp.price) as avg_price,
    MAX(hp.record_date) as latest_price_date
FROM areas a
LEFT JOIN developments d ON a.id = d.area_id
LEFT JOIN historical_prices hp ON a.id = hp.area_id
GROUP BY a.id, a.name, a.district;

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_area_statistics_district ON area_statistics (district);
CREATE INDEX IF NOT EXISTS idx_area_statistics_development_count ON area_statistics (development_count DESC);
CREATE INDEX IF NOT EXISTS idx_area_statistics_avg_price ON area_statistics (avg_price DESC);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_area_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY area_statistics;
END;
$$ LANGUAGE plpgsql;

-- Create a function for optimized area search
CREATE OR REPLACE FUNCTION search_areas_optimized(
    search_term TEXT DEFAULT NULL,
    district_filter TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    district VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    mrt_proximity DECIMAL(5, 2),
    cbd_distance DECIMAL(5, 2),
    amenity_score DECIMAL(3, 2),
    development_count BIGINT,
    avg_impact_score NUMERIC,
    recent_developments BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id, a.name, a.district, a.latitude, a.longitude,
        a.mrt_proximity, a.cbd_distance, a.amenity_score,
        COALESCE(ast.development_count, 0) as development_count,
        ast.avg_impact_score,
        COALESCE(ast.recent_developments, 0) as recent_developments
    FROM areas a
    LEFT JOIN area_statistics ast ON a.id = ast.id
    WHERE 
        (search_term IS NULL OR 
         a.name ILIKE '%' || search_term || '%' OR
         a.name % search_term) -- trigram similarity
    AND (district_filter IS NULL OR a.district = district_filter)
    ORDER BY 
        CASE 
            WHEN search_term IS NOT NULL AND a.name ILIKE search_term || '%' THEN 1
            WHEN search_term IS NOT NULL AND a.name ILIKE '%' || search_term || '%' THEN 2
            WHEN search_term IS NOT NULL THEN similarity(a.name, search_term)
            ELSE 0
        END DESC,
        ast.development_count DESC NULLS LAST,
        a.amenity_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;