import dotenv from 'dotenv';
import { SimpleApp } from './simpleApp';

// Load environment variables
dotenv.config({ path: '.env.local' });

const PORT = process.env.PORT || 8000;

async function startServer() {
  const app = new SimpleApp();
  
  try {
    // Initialize the app
    await app.initialize();
    
    // Start the server
    const server = app.getApp().listen(PORT, () => {
      console.log('🇸🇬 Singapore Housing Predictor API - Simple Mode');
      console.log('=============================================');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`🔍 Area search: http://localhost:${PORT}/api/areas/search`);
      console.log(`📊 Predictions: http://localhost:${PORT}/api/predictions/request`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Storage: File-based (no database required)`);
      console.log('=============================================');
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        console.log('🔒 HTTP server closed');
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();