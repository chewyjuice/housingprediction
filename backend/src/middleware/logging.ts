import { Request, Response, NextFunction } from 'express';

export interface LoggingRequest extends Request {
  startTime?: number;
  requestId?: string;
}

/**
 * Generate a unique request ID
 */
const generateRequestId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * Request logging middleware with timing
 */
export const requestLogger = (req: LoggingRequest, res: Response, next: NextFunction): void => {
  req.startTime = Date.now();
  req.requestId = generateRequestId();
  
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  console.log(`[${new Date().toISOString()}] [${req.requestId}] ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}`);
  
  // Log response when it finishes
  const originalSend = res.send;
  res.send = function(body: any) {
    const duration = Date.now() - (req.startTime || 0);
    const statusCode = res.statusCode;
    const contentLength = Buffer.byteLength(body || '', 'utf8');
    
    console.log(`[${new Date().toISOString()}] [${req.requestId}] ${method} ${url} - ${statusCode} - ${duration}ms - ${contentLength} bytes`);
    
    return originalSend.call(this, body);
  };
  
  next();
};

/**
 * Error logging middleware
 */
export const errorLogger = (error: Error, req: LoggingRequest, res: Response, next: NextFunction): void => {
  const { method, url } = req;
  const requestId = req.requestId || 'unknown';
  
  console.error(`[${new Date().toISOString()}] [${requestId}] ERROR ${method} ${url}:`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  next(error);
};