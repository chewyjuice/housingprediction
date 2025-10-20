# Requirements Document

## Introduction

The Singapore Housing Predictor is a web application that enables users to select specific areas in Singapore and receive predicted housing prices for future years. The system leverages web crawling technology to gather real-time information about area developments including schools, infrastructure, shopping centers, and business offices to inform price predictions.

## Glossary

- **Housing Predictor System**: The complete web application including user interface, prediction engine, and data collection components
- **Area Selection Interface**: The user interface component that allows users to choose specific locations in Singapore
- **Web Crawler**: The automated system that searches and extracts relevant news articles and development information from the internet
- **Prediction Engine**: The algorithmic component that processes crawled data and historical information to generate future price estimates
- **Development Data**: Information about schools, infrastructure, shopping centers, and business offices in a specific area
- **Price Prediction**: The estimated housing price for a selected area at a specified future time period

## Requirements

### Requirement 1

**User Story:** As a property investor, I want to select a specific area in Singapore, so that I can focus my analysis on locations of interest.

#### Acceptance Criteria

1. THE Housing Predictor System SHALL provide an interactive map interface for Singapore area selection
2. WHEN a user clicks on a map location, THE Housing Predictor System SHALL identify and display the selected area name
3. THE Housing Predictor System SHALL support selection of areas at multiple granularity levels including districts, neighborhoods, and postal code zones
4. THE Housing Predictor System SHALL validate that selected areas are within Singapore boundaries
5. THE Housing Predictor System SHALL store the user's area selection for subsequent prediction requests

### Requirement 2

**User Story:** As a property analyst, I want to specify a future time period for price predictions, so that I can plan investments according to my timeline.

#### Acceptance Criteria

1. THE Housing Predictor System SHALL accept user input for prediction timeframes between 1 and 10 years
2. WHEN a user enters an invalid timeframe, THE Housing Predictor System SHALL display an error message and request valid input
3. THE Housing Predictor System SHALL provide preset options for common prediction periods including 1, 3, 5, and 10 years
4. THE Housing Predictor System SHALL calculate prediction dates based on the current date plus the specified timeframe

### Requirement 3

**User Story:** As a data-driven investor, I want the system to automatically gather current development information about my selected area, so that predictions are based on the latest available data.

#### Acceptance Criteria

1. WHEN a prediction request is initiated, THE Web Crawler SHALL search for news articles about the selected area published within the last 12 months
2. THE Web Crawler SHALL extract information specifically about schools, infrastructure projects, shopping centers, and business office developments
3. THE Web Crawler SHALL process at least 3 different news sources for comprehensive coverage
4. IF no recent articles are found for an area, THEN THE Housing Predictor System SHALL notify the user and use historical data only
5. THE Web Crawler SHALL complete data collection within 60 seconds of request initiation

### Requirement 4

**User Story:** As a property buyer, I want to receive accurate price predictions with supporting rationale, so that I can make informed purchasing decisions.

#### Acceptance Criteria

1. THE Prediction Engine SHALL generate price estimates based on both historical price trends and current development data
2. THE Housing Predictor System SHALL display predicted prices in Singapore Dollars with accuracy to the nearest thousand
3. THE Housing Predictor System SHALL provide a confidence interval showing the range of possible price outcomes
4. THE Housing Predictor System SHALL present key development factors that influenced the prediction including specific schools, infrastructure, shopping, and business developments
5. WHEN prediction calculations are complete, THE Housing Predictor System SHALL display results within 10 seconds

### Requirement 5

**User Story:** As a real estate professional, I want to access historical prediction accuracy data, so that I can assess the reliability of the system's forecasts.

#### Acceptance Criteria

1. THE Housing Predictor System SHALL track actual vs predicted prices for areas where predictions were previously made
2. THE Housing Predictor System SHALL calculate and display prediction accuracy percentages for different time periods
3. WHEN a user requests accuracy data, THE Housing Predictor System SHALL show performance metrics for the selected area if available
4. THE Housing Predictor System SHALL maintain prediction history for at least 24 months
5. WHERE accuracy data is insufficient, THE Housing Predictor System SHALL clearly indicate limited historical validation