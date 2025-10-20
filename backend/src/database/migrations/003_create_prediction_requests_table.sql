-- Migration: Create prediction_requests table
-- Description: Store user prediction requests

CREATE TABLE IF NOT EXISTS prediction_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    timeframe_years INTEGER NOT NULL,
    request_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_prediction_requests_area_id ON prediction_requests (area_id);
CREATE INDEX IF NOT EXISTS idx_prediction_requests_user_id ON prediction_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_requests_request_date ON prediction_requests (request_date DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_requests_timeframe ON prediction_requests (timeframe_years);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_prediction_requests_area_timeframe ON prediction_requests (area_id, timeframe_years);
CREATE INDEX IF NOT EXISTS idx_prediction_requests_user_date ON prediction_requests (user_id, request_date DESC);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_prediction_requests_updated_at 
    BEFORE UPDATE ON prediction_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE prediction_requests ADD CONSTRAINT chk_prediction_requests_timeframe CHECK (timeframe_years >= 1 AND timeframe_years <= 10);