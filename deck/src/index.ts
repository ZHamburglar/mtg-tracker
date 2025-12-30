import mysql from 'mysql2/promise';
import path from 'path';
import { app } from "./app";
import { createMysqlPoolWithRetry } from './config/mysql';
import { createRedisClient, closeRedisClient } from './config/redis';
import { runMigrations } from '@mtg-tracker/common';
import { Deck } from './models/deck';
import { DeckCard } from './models/deck-card';

import { logger } from './logger';


let pool: mysql.Pool | undefined;

const start = async () => {
  logger.info('Starting up...', {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'development'
  });

  if (!process.env.MYSQL_HOST) {
    throw new Error("MYSQL_HOST must be defined");
  }

  if (!process.env.MYSQL_USER) {
    throw new Error("MYSQL_USER must be defined");
  }

  if (!process.env.MYSQL_PASSWORD) {
    throw new Error("MYSQL_PASSWORD must be defined");
  }

  if (!process.env.MYSQL_DATABASE) {
    throw new Error("MYSQL_DATABASE must be defined");
  }

  if (process.env.MYSQL_DATABASE && process.env.MYSQL_PASSWORD && process.env.MYSQL_USER && process.env.MYSQL_HOST) {
    logger.log(`Host: ${process.env.MYSQL_HOST}`);
    logger.log(`User: ${process.env.MYSQL_USER}`);
    logger.log(`Database: ${process.env.MYSQL_DATABASE}`);
  }

  pool = await createMysqlPoolWithRetry({ retries: 20, delay: 3000 });
  // You can export the pool or set it in a global variable if needed
  logger.log('pool created:', pool !== undefined);

  if (!pool) {
    throw new Error("Failed to create database pool.");
  }

  // Connect to Redis
  logger.log("Connecting to Redis...");
  await createRedisClient();
  logger.info('Redis client created successfully');


  // Run migrations from the migrations folder
  // Use process.cwd() to get the project root, then navigate to src/migrations
  const migrationsDir = path.join(process.cwd(), 'src', 'migrations');
  logger.log('Starting migrations from:', migrationsDir);
  
  try {
    await runMigrations(pool, migrationsDir, 'deck');
    logger.log('Migrations completed successfully');
  } catch (error) {
    logger.error('Error running migrations:', error);
    throw error;
  }

  // Initialize models with database pool
  Deck.setPool(pool);
  DeckCard.setPool(pool);

  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, () => {
    logger.log(`Listening on port ${port}!`);
  });
};

start();

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully...", {
    timestamp: new Date().toISOString()
  });
  await closeRedisClient();
  if (pool) {
    await pool.end();
    logger.info("Database connection closed");
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully...", {
    timestamp: new Date().toISOString()
  });
  await closeRedisClient();
  if (pool) {
    await pool.end();
    logger.info("Database connection closed");
  }
  process.exit(0);
});