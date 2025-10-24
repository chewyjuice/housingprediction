# Singapore Housing Predictor

A full-stack web application that predicts housing prices in Singapore based on area selection and real-time development data.

## 🚀 Quick Start

### Option 1: Automated Scripts (Recommended)

**Windows:**
```bash
# Start the application
scripts\start.bat

# Stop the application
scripts\stop.bat
```

**Linux/Mac:**
```bash
# Start the application
./scripts/start.sh

# Stop the application
./scripts/stop.sh
```

### Option 2: Manual Setup

**Prerequisites:**
- Node.js 18+ 
- npm or yarn

**Start Backend:**
```bash
cd backend
npm install
npm run dev:simple
```

**Start Frontend (in new terminal):**
```bash
cd frontend
npm install
npm start
```

**Access the Application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## 📁 Project Structure

```
singapore-housing-predictor/
├── scripts/                 # Startup/shutdown scripts
│   ├── start.bat           # Windows startup script
│   ├── stop.bat            # Windows shutdown script
│   ├── start.sh            # Linux/Mac startup script
│   └── stop.sh             # Linux/Mac shutdown script
├── frontend/                # React.js frontend application
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env.example
├── backend/                 # Node.js/Express backend API
│   ├── src/
│   ├── data/               # File-based storage
│   ├── package.json
│   └── .env.example
├── shared/                  # Shared TypeScript types
│   └── types/
└── README.md
```

## 🛠️ Technology Stack

### Frontend
- **React.js** with TypeScript
- **Leaflet.js** for interactive Singapore map
- **Chart.js** for prediction visualizations
- **Tailwind CSS** for styling

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **File-based storage** (no database required)
- **Simple prediction engine** with area-based calculations

## ✨ Features

- **Interactive Singapore Map**: Click to select areas like Tiong Bahru, Raffles Place, etc.
- **Price Predictions**: Get housing price forecasts for 1-10 years
- **Multiple Property Types**: HDB, Condo, and Landed properties
- **Confidence Intervals**: Statistical ranges for predictions
- **Real-time Processing**: Live prediction generation with polling
- **Responsive Design**: Works on desktop and mobile

## 🎯 How to Use

1. **Start the application** using the scripts above
2. **Open your browser** to http://localhost:3000
3. **Select an area** on the Singapore map
4. **Fill out the prediction form**:
   - Choose timeframe (1-10 years)
   - Select property type (HDB/Condo/Landed)
   - Set unit size and room type
5. **Click "Get Price Prediction"**
6. **View results** with price forecasts and confidence intervals

## 🔄 Data Extraction Workflow

The application implements a sophisticated **multi-source data extraction system** with automatic failover:

### Data Source Hierarchy
1. **Primary Sources** (Official APIs)
   - Singapore Government API for HDB data
   - URA API for private property transactions
   
2. **Backup Sources** (Web Scraping)
   - PropertyGuru for market data validation
   - 99.co for additional coverage
   
3. **Fallback Sources** (Simulated Data)
   - Market-based realistic estimates
   - Ensures system never fails completely

### Extraction Process
```bash
# Test individual data sources
npm run test:ura-api           # Verify URA API access and data structure
npm run test:propertyguru      # Test PropertyGuru scraping capabilities

# Extract data from all sources
npm run extract-resale         # Multi-source extraction with automatic fallback

# Monitor extraction status
curl http://localhost:8000/api/resale/summary  # Check data source status
```

### Configuration Files
- `backend/config/secrets.json` - API keys and credentials (gitignored)
- `backend/.env` - Environment variables
- Data automatically stored in `backend/data/` directory

### Troubleshooting Data Sources
- **URA API Issues**: Check your access key in `secrets.json`, verify API approval status
- **Web Scraping Issues**: PropertyGuru may have changed their structure, check console logs
- **No Data Available**: System automatically falls back to simulated realistic data

## 🔧 Development

### Backend Development
```bash
cd backend
npm run dev:simple              # Simple mode (file storage)
npm run dev                    # Full mode (with database)

# Data Extraction (Choose one)
npm run extract-resale         # Extract basic resale data (3 years)
npm run extract-comprehensive  # Extract comprehensive 5-year data from all sources

# Testing & Validation
npm run validate-apis          # **NEW**: Comprehensive API validation for all data sources
npm run test:hdb-datagovsg     # Test data.gov.sg HDB API connectivity and data structure
npm run test:ura-api           # Test URA API connectivity and data structure
npm run test:propertyguru      # Test PropertyGuru web scraping capabilities
npm run test:enhanced-districts # Test enhanced URA district mapping and analysis
npm test                       # Run tests

# Model retraining with enhanced districts
curl -X POST http://localhost:8000/api/model/retrain-enhanced

# Comprehensive data extraction via API
curl -X POST http://localhost:8000/api/resale/extract-comprehensive
```

### Frontend Development
```bash
cd frontend
npm start            # Development server
npm run build        # Production build
npm test             # Run tests
```

### 📊 Multi-Source Real Estate Data Integration

The application uses a **comprehensive multi-source data extraction system** for accurate Singapore property predictions:

**Extract Latest Market Data:**
```bash
cd backend
npm run extract-resale          # Extract from all available sources
npm run test:ura-api           # Test URA API connectivity
npm run test:propertyguru      # Test PropertyGuru scraping
```

**Data Sources (Priority Order):**
1. **Singapore Government (HDB)**: **Enhanced data.gov.sg API integration** with proper resource ID and batch processing
2. **URA API (Private Properties)**: Urban Redevelopment Authority official private property transactions
3. **PropertyGuru (Backup)**: Web scraping for additional market data
4. **Simulated Data (Fallback)**: Realistic market-based estimates when APIs are unavailable

**API Endpoints for Market Data:**
- `GET /api/validate-apis` - **NEW**: Comprehensive API validation for all data sources
- `POST /api/resale/extract` - Extract fresh data from all sources
- `POST /api/resale/extract-comprehensive` - **NEW**: Extract comprehensive 5-year data from all sources
- `GET /api/resale/summary` - View current data summary with source status
- `GET /api/resale/baselines` - Get market price baselines by area and property type
- `GET /api/districts/ura` - Get comprehensive URA district mapping with planning areas
- `GET /api/districts/ura/:districtCode` - Get detailed information for specific district (e.g., D01, D09)
- `POST /api/model/retrain-enhanced` - Retrain model with enhanced URA district data

**Coverage:**
- **HDB Properties**: **Enhanced data.gov.sg integration** with correct resource ID (`a1b0de62-0e54-4c2b-9c06-2fcbfe9d16b9`)
- **5+ Years of Data**: Up to 500,000+ HDB transactions with proper date filtering and sorting
- **Private Properties**: **Comprehensive URA API extraction** with multi-batch processing for complete historical data
- **Areas**: Complete Singapore coverage with 28 URA districts and planning areas
- **Granular Districts**: Sub-district analysis with planning areas and neighborhood-level data
- **Batch Processing**: Intelligent batch extraction to get ALL available data (not just 100 transactions)
- **Fallback System**: Automatic failover ensures data availability even when APIs are down

**data.gov.sg HDB Data Integration:**
- **No API Key Required**: Direct access to Singapore government data
- **Resource ID**: `a1b0de62-0e54-4c2b-9c06-2fcbfe9d16b9` (HDB Resale Flat Prices)
- **API Endpoint**: `https://data.gov.sg/api/action/datastore_search`
- **Features**: Date filtering, sorting, batch processing, comprehensive coverage
- **Test Command**: `npm run test:hdb-datagovsg`

**URA API Setup:**
1. Visit [URA Developer Portal](https://www.ura.gov.sg/maps/api/)
2. Register for API access (requires approval)
3. Get your Access Key from the portal
4. Save it in `backend/config/secrets.json`:
   ```json
   {
     "ura_access_key": "your_actual_access_key_here"
   }
   ```
5. The system will automatically detect and use your key

**Enhanced District Analysis:**
- **28 URA Districts**: Complete coverage from D01 (Downtown Core) to D28 (Seletar)
- **Planning Areas**: Detailed mapping to Singapore's official planning areas
- **Sub-Districts**: Neighborhood-level analysis within each district
- **Price Variations**: Sub-district price analysis and market trends
- **Location Intelligence**: Enhanced location matching and area-specific insights

**Data Source Status Monitoring:**
- Real-time monitoring of all data sources
- Automatic failover when sources are unavailable
- Error tracking and recovery mechanisms
- Source priority management for optimal data quality

## 📊 API Endpoints

### Health Check
- `GET /health` - Check backend status

### Areas
- `GET /api/areas/search` - Search Singapore areas
- `GET /api/areas/:id` - Get specific area details

### Predictions
- `POST /api/predictions/request` - Create prediction request
- `GET /api/predictions/request/:id` - Get prediction result

## 🐛 Troubleshooting

### Common Issues

**"Area not found" Error:**
- **Cause**: Backend using cached/stale area data
- **Quick Fix**: `curl -X POST http://localhost:8000/api/areas/refresh`
- **Permanent Fix**: Restart backend server
- **Verification**: Check logs show "28 comprehensive Singapore districts"

**"Prediction Failed" Error:**
- Check browser console (F12) for detailed logs
- Ensure both backend and frontend are running
- Verify backend is accessible at http://localhost:8000
- Check specific area exists: `curl http://localhost:8000/api/areas/{area-id}`

**"$NaN/sqft" or Incorrect PSF Values:**
- **Cause**: Unit conversion errors between sqm and sqft
- **Fix**: Restart backend server (fixed in latest version)
- **Expected**: PSF values should be 1,000-3,000 range for Singapore

**"Cannot read properties of undefined" Errors:**
- **Cause**: Missing null checks in frontend components
- **Fix**: Refresh browser page (fixed in latest version)
- **Prevention**: All components now handle undefined values gracefully

**"Unexpected token '<', "<!DOCTYPE"... JSON Error:**
- **Cause**: Frontend calling wrong API URLs
- **Fix**: Ensure backend is running on port 8000
- **Check**: API calls should go to `http://localhost:8000/api/...`

**Districts Missing from Map:**
- **Cause**: Frontend-backend area data mismatch
- **Fix**: Both now use same 28 Singapore districts
- **Verification**: Map should show all districts D01-D28

**Port Already in Use:**
- Backend (8000): Change port in backend/.env
- Frontend (3000): React will prompt to use different port

**Installation Issues:**
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`

### Debug Mode

Enable detailed logging by opening browser console (F12) and watching for:
- `[PREDICTION]` logs for prediction flow
- `[POLLING]` logs for result polling
- `[API]` logs for HTTP requests
- `[AREAS]` logs for area initialization

### Advanced Troubleshooting

**Force Refresh Area Data:**
```bash
# Clear cached area data and reinitialize
curl -X POST http://localhost:8000/api/areas/refresh

# Check specific area exists
curl http://localhost:8000/api/areas/pasir-ris

# List all available areas
curl http://localhost:8000/api/areas
```

**Verify API Endpoints:**
```bash
# Test API validation
curl http://localhost:8000/api/validate-apis

# Test URA districts
curl http://localhost:8000/api/districts/ura

# Test market summary
curl http://localhost:8000/api/resale/summary

# Test model info
curl http://localhost:8000/api/model/info
```

**Backend Logs to Watch For:**
```
[AREAS] Loaded X areas from storage
[AREAS] Initialized 28 comprehensive Singapore districts
[AREAS] Pasir Ris included: true
[PREDICTION] Area not found for ID: "area-name"
[API Validation] Making request to http://localhost:8000/api/...
```

**Common Fix Sequence:**
1. **Restart backend server** (fixes most caching issues)
2. **Refresh browser page** (clears frontend cache)
3. **Check browser console** for specific error messages
4. **Use debug endpoints** to verify data availability

## 🚦 System Status

The application includes built-in health monitoring:
- **Green indicator**: Backend connected, full functionality
- **Yellow indicator**: Demo mode, simulated predictions
- **Red indicator**: Connection issues

## 📝 License

This project is licensed under the MIT License.

## Core Features

- **Interactive Singapore Map**: Select areas using an interactive map interface
- **Price Prediction**: Get housing price forecasts for 1-10 year timeframes
- **Real-time Data Collection**: Automated web crawling for development information
- **Confidence Intervals**: Statistical confidence ranges for predictions
- **Historical Accuracy**: Track prediction accuracy over time
- **Development Impact Analysis**: See how new developments affect price predictions

## API Endpoints

### Area Selection
- `GET /api/areas/search` - Search for Singapore areas
- `POST /api/areas/validate` - Validate area boundaries

### Predictions
- `POST /api/predictions/request` - Request price prediction
- `GET /api/predictions/history` - Get prediction history

### Accuracy Metrics
- `GET /api/accuracy/metrics` - Get historical accuracy data

## Development Guidelines

- Follow TypeScript strict mode for type safety
- Use shared types from `/shared/types/` across services
- Implement proper error handling and validation
- Write unit tests for core functionality
- Use Docker for consistent development environments

## License

This project is licensed under the MIT License.