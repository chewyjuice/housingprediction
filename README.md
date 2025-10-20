# Singapore Housing Predictor

A full-stack web application that predicts housing prices in Singapore based on area selection and real-time development data.

## Project Structure

```
singapore-housing-predictor/
├── frontend/                 # React.js frontend application
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── Dockerfile
├── backend/                  # Node.js/Express backend API
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   └── Dockerfile
├── ml-service/              # Python ML service
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── shared/                  # Shared TypeScript types
│   └── types/
│       └── index.ts
├── docker-compose.yml       # Multi-service orchestration
├── nginx.conf              # Reverse proxy configuration
└── README.md
```

## Technology Stack

### Frontend
- React.js with TypeScript
- Leaflet.js for interactive maps
- Chart.js for data visualization
- Tailwind CSS for styling

### Backend
- Node.js with Express.js
- TypeScript for type safety
- PostgreSQL for data storage
- Redis for caching and job queues
- Bull for background job processing

### ML Service
- Python with FastAPI
- scikit-learn for machine learning
- Beautiful Soup + Scrapy for web crawling
- NLTK for natural language processing

### Infrastructure
- Docker for containerization
- nginx for reverse proxy
- Docker Compose for orchestration

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)

### Quick Start with Docker

1. Clone the repository
2. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   cp ml-service/.env.example ml-service/.env
   ```
3. Start all services:
   ```bash
   docker-compose up -d
   ```
4. Access the application at http://localhost

### Local Development

#### Backend
```bash
cd backend
npm install
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
npm start
```

#### ML Service
```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

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