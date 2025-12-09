import { createClient } from '@redis/client';
import type { RedisClientType } from '@redis/client';
import { logger } from '../logger';

let redisClient: RedisClientType | null = null;

export async function createRedisClient(): Promise<RedisClientType> {
  const redis = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'redis-srv',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      reconnectStrategy: (retries) => {
        const delay = Math.min(retries * 50, 2000);
        return delay;
      },
    },
  });

  redis.on('connect', () => {
    logger.info('Redis client connected');
  });

  redis.on('error', (err) => {
    logger.error('Redis client error', { error: err.message });
  });

  try {
    await redis.connect();
    logger.info('Redis connection established');
    redisClient = redis;
    return redis;
  } catch (error) {
    logger.error('Failed to connect to Redis', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call createRedisClient() first.');
  }
  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

export function isRedisConnected(): boolean {
  return redisClient?.isOpen ?? false;
}
