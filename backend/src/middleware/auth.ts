import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * Basic JWT authentication middleware
 * For now, this is a simple implementation - in production, you'd want more robust auth
 */
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    // For now, allow requests without tokens (optional auth)
    // In production, you might want to require auth for certain endpoints
    return next();
  }

  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  
  jwt.verify(token, jwtSecret, (err: any, user: any) => {
    if (err) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid or expired token'
      };
      res.status(403).json(response);
      return;
    }
    
    req.user = user;
    next();
  });
};

/**
 * Generate a JWT token for testing purposes
 */
export const generateTestToken = (userId: string, email?: string): string => {
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign(
    { id: userId, email },
    jwtSecret,
    { expiresIn: '24h' }
  );
};

/**
 * Middleware to require authentication
 */
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Authentication required'
    };
    res.status(401).json(response);
    return;
  }
  next();
};