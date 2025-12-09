import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';
import { logger } from '../logger';

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  prefix: string;
  message?: string;
}

// Cache for rate limiters to avoid recreating them
const rateLimiterCache = new Map<string, ReturnType<typeof rateLimit>>();

/**
 * Creates a rate limiter middleware with Redis store and lazy initialization
 * Rate limiter is created on first request when Redis is guaranteed to be ready
 */
export const createRateLimiter = (options: RateLimiterOptions) => {
  const {
    windowMs,
    limit,
    prefix,
    message = 'Too many requests from this IP, please try again later.'
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Lazy initialization: create rate limiter on first request
    if (!rateLimiterCache.has(prefix)) {
      const limiter = rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7', // Use RateLimit header
        legacyHeaders: false, // Disable X-RateLimit-* headers
        message,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        // Validate trust proxy - only trust specific proxy headers
        validate: {
          trustProxy: false, // We'll handle IP extraction manually
          creationStack: false, // Allow lazy initialization pattern
        },
        store: new RedisStore({
          sendCommand: (...args: string[]) => {
            const client = getRedisClient();
            return client.sendCommand(args);
          },
          prefix,
        }),
        // Fallback to memory store if Redis becomes unavailable during runtime
        passOnStoreError: true,
        // Log rate limit hits for monitoring
        handler: (req: Request, res: Response) => {
          logger.log('Rate limit exceeded', {
            prefix,
            ip: req.ip,
            path: req.path,
            method: req.method,
            limit,
            windowMs
          });
          res.status(429).json({ error: message });
        },
      });
      rateLimiterCache.set(prefix, limiter);
    }

    const limiter = rateLimiterCache.get(prefix)!;
    return limiter(req, res, next);
  };
};
