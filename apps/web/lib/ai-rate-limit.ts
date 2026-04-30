import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { AI_LIMITS } from '@remote-care/shared';

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return new Redis({ url, token });
}

let reportLimiter: Ratelimit | null = null;
let chatLimiter: Ratelimit | null = null;

function getReportLimiter(): Ratelimit | null {
  if (reportLimiter) return reportLimiter;
  const redis = getRedis();
  if (!redis) return null;
  reportLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(AI_LIMITS.REPORT_PER_DAY, '1 d'),
    prefix: 'ai-report',
  });
  return reportLimiter;
}

function getChatLimiter(): Ratelimit | null {
  if (chatLimiter) return chatLimiter;
  const redis = getRedis();
  if (!redis) return null;
  chatLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(AI_LIMITS.CHAT_PER_DAY, '1 d'),
    prefix: 'ai-chat',
  });
  return chatLimiter;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

/**
 * Check report rate limit: 3 per recipient+type per hour.
 * Key format: {userId}:{recipientId}:{reportType}
 */
export async function checkReportRateLimit(
  userId: string,
  recipientId: string,
  reportType: string,
): Promise<RateLimitResult> {
  const limiter = getReportLimiter();
  if (!limiter) {
    // Local dev without Upstash — allow all, log warning
    console.warn('[ai-rate-limit] UPSTASH_REDIS_REST_URL not set — rate limiting disabled (dev only)');
    return { allowed: true, remaining: AI_LIMITS.REPORT_PER_DAY, reset: 0 };
  }

  const key = `${userId}:${recipientId}:${reportType}`;
  const result = await limiter.limit(key);
  return {
    allowed: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Check chat rate limit: 10 per user per hour.
 * Key format: {userId}
 */
export async function checkChatRateLimit(userId: string): Promise<RateLimitResult> {
  const limiter = getChatLimiter();
  if (!limiter) {
    console.warn('[ai-rate-limit] UPSTASH_REDIS_REST_URL not set — rate limiting disabled (dev only)');
    return { allowed: true, remaining: AI_LIMITS.CHAT_PER_DAY, reset: 0 };
  }

  const result = await limiter.limit(userId);
  return {
    allowed: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}
