# Implementation Plan

- [x] 1. Set up project structure and core interfaces





  - Create directory structure for frontend (React), backend (Node.js), and ML components (Python)
  - Initialize package.json files with required dependencies
  - Set up TypeScript configuration for type safety
  - Create Docker configuration files for containerization
  - Define core TypeScript interfaces for Area, Development, Prediction, and HistoricalPrice models
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

- [x] 2. Implement database schema and data access layer





  - [x] 2.1 Create PostgreSQL database schema


    - Write SQL migration files for areas, developments, predictions, and historical_prices tables
    - Set up database indexes for optimal query performance
    - Create database connection and configuration management
    - _Requirements: 1.5, 3.4, 4.4, 5.4_
  
  - [x] 2.2 Implement repository pattern for data access


    - Create base repository interface with CRUD operations
    - Implement AreaRepository with boundary validation and search methods
    - Implement DevelopmentRepository with categorization and filtering
    - Implement PredictionRepository with historical tracking
    - _Requirements: 1.1, 1.2, 3.2, 4.1, 5.1_
  
  - [x] 2.3 Write unit tests for repository operations






    - Test area boundary validation and search functionality
    - Test development data storage and retrieval
    - Test prediction history tracking
    - _Requirements: 1.4, 3.4, 4.4, 5.4_

- [x] 3. Build Singapore area selection system




  - [x] 3.1 Implement area data management


    - Create Singapore area data seeding with districts and postal codes
    - Implement area boundary validation using coordinate checking
    - Build area search functionality with name-based queries
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 3.2 Create area selection API endpoints


    - Implement GET /api/areas/search endpoint with query parameters
    - Implement POST /api/areas/validate endpoint for boundary checking
    - Add error handling for invalid area selections
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [ ]* 3.3 Write integration tests for area selection
    - Test area search with various query types
    - Test boundary validation with edge cases
    - Test API endpoint responses and error handling
    - _Requirements: 1.1, 1.2, 1.4_

- [x] 4. Develop web crawler service for development data





  - [x] 4.1 Implement news source crawlers


    - Create base crawler class with rate limiting and retry logic
    - Implement Straits Times crawler with article extraction
    - Implement Channel NewsAsia crawler with content parsing
    - Implement PropertyGuru crawler for property-specific news
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 4.2 Build content extraction and processing


    - Implement text cleaning and HTML removal utilities
    - Create keyword-based filtering for development-related content
    - Build article deduplication based on content similarity
    - Implement date range filtering for 12-month window
    - _Requirements: 3.1, 3.2, 3.4_
  
  - [x] 4.3 Create crawler job queue and scheduling


    - Set up Bull queue for background crawling jobs
    - Implement crawler service with 60-second timeout handling
    - Create job scheduling for periodic data updates
    - Add error handling and retry mechanisms for failed crawls
    - _Requirements: 3.1, 3.3, 3.5_
  
  - [x] 4.4 Write tests for web crawler functionality






    - Test individual crawler implementations with mock responses
    - Test content extraction and filtering algorithms
    - Test job queue processing and error handling
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. Implement data processing and categorization system





  - [x] 5.1 Build development categorization engine


    - Create NLP-based text classification for development types (school/infrastructure/shopping/business)
    - Implement entity extraction for project names and locations
    - Build development impact scoring algorithm based on project significance
    - _Requirements: 3.2, 4.4_
  
  - [x] 5.2 Create data processing pipeline


    - Implement processing service that consumes crawler output
    - Build data validation and quality checking mechanisms
    - Create structured data transformation from raw articles to Development models
    - Add location relevance verification for extracted developments
    - _Requirements: 3.2, 4.4_
  
  - [x] 5.3 Write unit tests for data processing






    - Test development categorization accuracy
    - Test entity extraction and impact scoring
    - Test data validation and transformation logic
    - _Requirements: 3.2, 4.4_

- [x] 6. Build machine learning prediction engine





  - [x] 6.1 Implement historical price analysis


    - Create price trend calculation using 5-year moving averages
    - Implement base linear regression model for historical predictions
    - Build area characteristics scoring (MRT proximity, CBD distance)
    - _Requirements: 4.1, 4.2_
  
  - [x] 6.2 Develop ensemble prediction model


    - Integrate development impact scores into prediction features
    - Implement ensemble method combining multiple prediction approaches
    - Create confidence interval calculation using bootstrap sampling
    - Build prediction explanation generation showing key influencing factors
    - _Requirements: 4.1, 4.3, 4.4_
  
  - [x] 6.3 Create prediction service API


    - Implement POST /api/predictions/request endpoint with timeframe validation
    - Build prediction result formatting and response generation
    - Add 10-second timeout handling for prediction calculations
    - Create prediction history storage and retrieval
    - _Requirements: 2.1, 2.2, 4.1, 4.5_
  
  - [x] 6.4 Write tests for prediction engine





    - Test historical price analysis and trend calculations
    - Test ensemble model accuracy with validation data
    - Test prediction API endpoints and response formatting
    - _Requirements: 4.1, 4.2, 4.5_

- [x] 7. Develop frontend user interface




  - [x] 7.1 Create interactive Singapore map component


    - Implement Leaflet.js map with Singapore boundaries
    - Build area selection functionality with click handlers
    - Create area highlighting and selection feedback
    - Add map controls for zoom and navigation
    - _Requirements: 1.1, 1.2, 1.5_
  
  - [x] 7.2 Build prediction form and input validation


    - Create timeframe selection with 1-10 year validation
    - Implement preset options for 1, 3, 5, and 10 years
    - Add form validation with error message display
    - Build prediction request submission handling
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 7.3 Implement results visualization


    - Create prediction results display with price formatting
    - Build confidence interval visualization using charts
    - Implement influencing factors display with development details
    - Add loading states and progress indicators
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  
  - [x] 7.4 Create historical accuracy dashboard


    - Implement accuracy metrics display for different time periods
    - Build historical prediction vs actual price comparisons
    - Create area-specific accuracy data visualization
    - Add insufficient data warnings and indicators
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  
  - [x] 7.5 Write frontend component tests






    - Test map interaction and area selection
    - Test form validation and submission
    - Test results display and visualization
    - Test accuracy dashboard functionality
    - _Requirements: 1.1, 2.1, 4.1, 5.1_

- [x] 8. Implement API gateway and service integration





  - [x] 8.1 Create Express.js API gateway


    - Set up Express server with middleware for CORS and JSON parsing
    - Implement request routing to appropriate microservices
    - Add rate limiting and basic authentication
    - Create unified error handling and response formatting
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_
  
  - [x] 8.2 Build service orchestration


    - Implement prediction workflow orchestrating crawler, processing, and ML services
    - Create service health checking and monitoring
    - Add request/response logging and debugging
    - Build service discovery and configuration management
    - _Requirements: 3.5, 4.5_
  
  - [x] 8.3 Write integration tests for API gateway






    - Test end-to-end prediction request workflow
    - Test service routing and error handling
    - Test rate limiting and authentication
    - _Requirements: 1.1, 2.1, 3.5, 4.5_

- [ ] 9. Set up caching and performance optimization









  - [x] 9.1 Implement Redis caching layer

 
    - Set up Redis connection and configuration
    - Create caching for frequently accessed area data
    - Implement prediction result caching with TTL
    - Add cache invalidation for updated development data
    - _Requirements: 1.5, 4.5_
  
  - [x] 9.2 Optimize database queries and indexing


















    - Create database indexes for area searches and prediction queries
    - Implement query optimization for large datasets
    - Add connection pooling for database performance
    - Create database monitoring and performance metrics
    - _Requirements: 1.2, 3.5, 4.5, 5.2_
  
  - [ ]* 9.3 Write performance tests
    - Test concurrent user handling and response times
    - Test database query performance under load
    - Test caching effectiveness and hit rates
    - _Requirements: 3.5, 4.5_

- [x] 10. Integrate all components and final testing







  - [x] 10.1 Wire together frontend and backend services


    - Connect React frontend to API gateway endpoints
    - Implement error handling and user feedback throughout the application
    - Add loading states and progress indicators for long-running operations
    - Create end-to-end user workflows from area selection to prediction results
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_
  
  - [x] 10.2 Implement production deployment configuration


    - Create Docker Compose configuration for multi-service deployment
    - Set up nginx reverse proxy configuration
    - Configure environment variables and secrets management
    - Add health check endpoints for all services
    - _Requirements: 3.5, 4.5_
  
  - [ ]* 10.3 Write end-to-end system tests
    - Test complete user workflows from area selection to prediction display
    - Test system behavior under various data availability scenarios
    - Test error handling and recovery mechanisms
    - Validate prediction accuracy with historical data
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_