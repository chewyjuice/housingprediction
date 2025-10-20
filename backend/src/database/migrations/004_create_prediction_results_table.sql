-- Migration: Create prediction_results table
-- Description: Store prediction results and analysis

CREATE TABLE IF NOT EXISTS prediction_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES prediction_requests(id) ON DELETE CASCADE,
    predicted_price DECIMAL(12, 2) NOT NULL,
    confidence_lower DECIMAL(12, 2) NOT NULL,
    confidence_upper DECIMAL(12, 2) NOT NULL,
    influencing_factors JSONB NOT NULL DEFAULT '[]',
    model_accuracy DECIMAL(5, 2),
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_prediction_results_request_id ON prediction_results (request_id);
CREATE INDEX IF NOT EXISTS idx_prediction_results_predicted_price ON prediction_results (predicted_price);
CREATE INDEX IF NOT EXISTS idx_prediction_results_generated_at ON prediction_results (generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_results_model_accuracy ON prediction_results (model_accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_results_influencing_factors ON prediction_results USING gin(influencing_factors);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_prediction_results_updated_at 
    BEFORE UPDATE ON prediction_results 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE prediction_results ADD CONSTRAINT chk_prediction_results_price_positive CHECK (predicted_price > 0);
ALTER TABLE prediction_results ADD CONSTRAINT chk_prediction_results_confidence_order CHECK (confidence_lower <= predicted_price AND predicted_price <= confidence_upper);
ALTER TABLE prediction_results ADD CONSTRAINT chk_prediction_results_confidence_positive CHECK (confidence_lower > 0 AND confidence_upper > 0);
ALTER TABLE prediction_results ADD CONSTRAINT chk_prediction_results_accuracy CHECK (model_accuracy IS NULL OR (model_accuracy >= 0 AND model_accuracy <= 100));

-- Unique constraint to prevent duplicate results for same request
CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_results_unique_request 
    ON prediction_results (request_id);