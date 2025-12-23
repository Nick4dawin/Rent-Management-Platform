import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../utils/auth';
import logger from '../config/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Middleware to authenticate JWT token
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    req.user = payload;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Middleware to check user role
 */
export function authorize(...allowedRoles: Array<'super-admin' | 'mandator' | 'tenant'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.userType)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to ensure multi-tenant data isolation
 * Validates that mandator-scoped requests only access their own data
 */
export function enforceDataIsolation(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  // Super admin can access all data
  if (req.user.userType === 'super-admin') {
    next();
    return;
  }

  // For mandator and tenant users, ensure mandatorId is set
  if (req.user.userType === 'mandator' || req.user.userType === 'tenant') {
    if (!req.user.mandatorId) {
      res.status(403).json({
        success: false,
        message: 'Invalid user context',
      });
      return;
    }
  }

  next();
}
