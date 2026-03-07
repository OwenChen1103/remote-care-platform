import { NextRequest } from 'next/server';

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'http://localhost:8081',
].filter(Boolean) as string[];

export function checkOrigin(request: NextRequest): boolean {
  // Only check mutation methods
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return true;
  }

  const origin = request.headers.get('origin');

  // Mobile apps (React Native) don't send Origin header
  if (!origin) {
    return true;
  }

  return ALLOWED_ORIGINS.includes(origin);
}
