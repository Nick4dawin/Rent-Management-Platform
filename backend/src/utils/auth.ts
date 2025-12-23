import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config';

const SALT_ROUNDS = 10;

export interface JWTPayload {
  userId: string;
  userType: 'super-admin' | 'mandator' | 'tenant';
  mandatorId?: string;
  email: string;
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate access token
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, CONFIG.JWT_SECRET, {
    expiresIn: CONFIG.JWT_EXPIRES_IN,
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, CONFIG.JWT_REFRESH_SECRET, {
    expiresIn: CONFIG.JWT_REFRESH_EXPIRES_IN,
  });
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, CONFIG.JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, CONFIG.JWT_REFRESH_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Generate SMS verification code
 */
export function generateSMSCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Get SMS code expiry time (10 minutes from now)
 */
export function getSMSCodeExpiry(): Date {
  return new Date(Date.now() + 10 * 60 * 1000);
}
