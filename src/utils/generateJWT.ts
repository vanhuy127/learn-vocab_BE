import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_TOKEN_KEY = process.env.ACCESS_TOKEN_KEY;
const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 ngày, tính theo ms;

export function generateAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, ACCESS_TOKEN_KEY!, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): {
  decoded?: JwtPayload;
  error?: string;
} {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_KEY!) as JwtPayload;
    return { decoded };
  } catch (error: any) {
    console.error('Error verifying access token:', error);
    if (error.name === 'TokenExpiredError') {
      return { error: 'TOKEN_EXPIRED' };
    }

    return { error: 'INVALID_TOKEN' };
  }
}

export function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}
