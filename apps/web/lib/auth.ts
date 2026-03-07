import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@remote-care/shared';

export interface AuthPayload {
  userId: string;
  role: UserRole;
}

interface JwtPayloadData {
  userId: string;
  role: UserRole;
  iat: number;
  exp: number;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? '';
}

const JWT_EXPIRES_IN = '7d';

export function signJwt(payload: { userId: string; role: UserRole }): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN,
  });
}

function verifyJwt(token: string): AuthPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    }) as JwtPayloadData;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

export async function verifyAuth(request: NextRequest): Promise<AuthPayload | null> {
  // Strategy 1: Authorization header (Mobile)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifyJwt(token);
  }

  // Strategy 2: httpOnly cookie (Web Admin)
  const cookieToken = request.cookies.get('auth_token')?.value;
  if (cookieToken) {
    return verifyJwt(cookieToken);
  }

  return null;
}
