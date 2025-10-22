from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import psutil
import time
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Singapore Housing Predictor ML Service",
    description="Machine Learning service for housing price predictions",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store service start time for uptime calculation
start_time = time.time()

@app.get("/")
async def root():
    return {
        "message": "Singapore Housing Predictor ML Service",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring and load balancers
    """
    try:
        # Calculate uptime
        uptime_seconds = time.time() - start_time
        uptime_hours = uptime_seconds / 3600
        
        # Get system metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Determine health status
        status = "healthy"
        issues = []
        
        # Check CPU usage
        if cpu_percent > 90:
            status = "degraded"
            issues.append("High CPU usage")
        
        # Check memory usage
        if memory.percent > 90:
            status = "degraded"
            issues.append("High memory usage")
        
        # Check disk usage
        if disk.percent > 90:
            status = "degraded"
            issues.append("High disk usage")
        
        # Check if any critical issues
        if cpu_percent > 95 or memory.percent > 95 or disk.percent > 95:
            status = "unhealthy"
        
        health_data = {
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": round(uptime_seconds, 2),
            "uptime_hours": round(uptime_hours, 2),
            "system": {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available_gb": round(memory.available / (1024**3), 2),
                "disk_percent": disk.percent,
                "disk_free_gb": round(disk.free / (1024**3), 2)
            },
            "service": {
                "name": "ml-service",
                "version": "1.0.0",
                "environment": os.getenv("NODE_ENV", "development")
            }
        }
        
        if issues:
            health_data["issues"] = issues
        
        # Return appropriate HTTP status code
        if status == "unhealthy":
            raise HTTPException(status_code=503, detail=health_data)
        
        return health_data
        
    except Exception as e:
        # If health check itself fails, return unhealthy status
        error_response = {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e),
            "service": {
                "name": "ml-service",
                "version": "1.0.0"
            }
        }
        raise HTTPException(status_code=503, detail=error_response)

@app.get("/predict")
async def predict():
    """
    Placeholder for ML prediction logic
    """
    return {
        "prediction": "Not implemented yet",
        "message": "ML prediction endpoint is under development",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/models/status")
async def models_status():
    """
    Check the status of loaded ML models
    """
    return {
        "models": {
            "price_predictor": {
                "status": "not_loaded",
                "version": None,
                "last_trained": None
            },
            "development_analyzer": {
                "status": "not_loaded", 
                "version": None,
                "last_trained": None
            }
        },
        "message": "Model loading is under development",
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"Starting ML Service on {host}:{port}")
    uvicorn.run(
        app, 
        host=host, 
        port=port,
        log_level="info",
        access_log=True
    )