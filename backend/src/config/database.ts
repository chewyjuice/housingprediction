import { DatabaseConfig, RedisConfig, AppConfig } from '../types';

export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'singapore_housing_predictor',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  };
}

export function getRedisConfig(): RedisConfig {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  };
}

export function getAppConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3001'),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    database: getDatabaseConfig(),
    redis: getRedisConfig(),
  };
}

export function validateConfig(): void {
  const requiredEnvVars = [
    'DB_HOST',
    'DB_NAME', 
    'DB_USER',
    'DB_PASSWORD'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate database port
  const dbPort = parseInt(process.env.DB_PORT || '5432');
  if (isNaN(dbPort) || dbPort < 1 || dbPort > 65535) {
    throw new Error('Invalid DB_PORT: must be a number between 1 and 65535');
  }

  // Validate Redis port
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');
  if (isNaN(redisPort) || redisPort < 1 || redisPort > 65535) {
    throw new Error('Invalid REDIS_PORT: must be a number between 1 and 65535');
  }

  // Validate app port
  const appPort = parseInt(process.env.PORT || '3001');
  if (isNaN(appPort) || appPort < 1 || appPort > 65535) {
    throw new Error('Invalid PORT: must be a number between 1 and 65535');
  }

  console.log('Configuration validation passed');
}