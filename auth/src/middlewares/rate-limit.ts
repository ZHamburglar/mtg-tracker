import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key] && store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 10 * 60 * 1000);

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string;
  statusCode?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const rateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    statusCode = 429,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Get client IP from headers or connection
    const clientIP = (
      req.headers['x-real-ip'] || 
      req.headers['x-forwarded-for'] || 
      req.connection.remoteAddress || 
      req.socket.remoteAddress
    ) as string;

    const key = `${clientIP}:${req.path}`;
    const now = Date.now();

    // Initialize or get existing rate limit data
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs
      };
    }

    // Increment the count
    store[key].count++;

    // Set rate limit headers
    const remaining = Math.max(0, max - store[key].count);
    const resetTime = Math.ceil(store[key].resetTime / 1000);

    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetTime.toString());

    // Check if limit exceeded
    if (store[key].count > max) {
      res.setHeader('Retry-After', Math.ceil((store[key].resetTime - now) / 1000).toString());
      return res.status(statusCode).json({
        errors: [{
          message,
          retryAfter: Math.ceil((store[key].resetTime - now) / 1000)
        }]
      });
    }

    // Handle skip options
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalJson = res.json.bind(res);
      res.json = function(body: any) {
        const shouldDecrement = 
          (skipSuccessfulRequests && res.statusCode >= 200 && res.statusCode < 300) ||
          (skipFailedRequests && res.statusCode >= 400);

        if (shouldDecrement && store[key]) {
          store[key].count = Math.max(0, store[key].count - 1);
        }

        return originalJson(body);
      };
    }

    next();
  };
};
