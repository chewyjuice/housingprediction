import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

/**
 * Middleware to validate request body exists
 */
export const validateRequestBody = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.body || Object.keys(req.body).length === 0) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Request body is required'
    };
    res.status(400).json(response);
    return;
  }
  next();
};

/**
 * Middleware to validate specific fields in request body
 */
export const validateFields = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (!(field in req.body) || req.body[field] === undefined || req.body[field] === null) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      };
      res.status(400).json(response);
      return;
    }
    
    next();
  };
};

/**
 * Middleware to validate area ID parameter
 */
export const validateAreaId = (req: Request, res: Response, next: NextFunction): void => {
  const { areaId } = req.params;
  
  if (!areaId || typeof areaId !== 'string' || areaId.trim().length === 0) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Valid area ID is required'
    };
    res.status(400).json(response);
    return;
  }
  
  next();
};

/**
 * Middleware to validate prediction timeframe
 */
export const validateTimeframe = (req: Request, res: Response, next: NextFunction): void => {
  const { timeframeYears } = req.body;
  
  if (!timeframeYears || typeof timeframeYears !== 'number') {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Timeframe years must be a number'
    };
    res.status(400).json(response);
    return;
  }
  
  if (timeframeYears < 1 || timeframeYears > 10) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Timeframe must be between 1 and 10 years'
    };
    res.status(400).json(response);
    return;
  }
  
  next();
};