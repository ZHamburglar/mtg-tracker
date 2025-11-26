import mysql from 'mysql2/promise';
import { logger } from '../logger';
import { DatabaseConnectionError } from '@mtg-tracker/common';

export async function createMysqlPoolWithRetry({
  retries = 10,
  delay = 2000,
} = {}) {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'mysql',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER!,
    password: process.env.MYSQL_PASSWORD!,
    database: process.env.MYSQL_DATABASE!,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 60000,
  });

  while (retries > 0) {
    try {
      logger.log("Attempting MySQL connection...");

      // Test connection by getting a connection from pool
      const conn = await pool.getConnection();

      // Optional test query
      await conn.query("SELECT 1");

      conn.release();

      logger.log("MySQL pool connected successfully!");
      return pool;

    } catch (err) {
      retries -= 1;
      logger.error(`MySQL connection failed. Retries left: ${retries}`);
      logger.error("Error:", err instanceof Error ? err.message : String(err));

      if (retries === 0) {
        logger.error("Out of retries. MySQL is unreachable.");
        throw new DatabaseConnectionError(err instanceof Error ? err : new Error(String(err)));
      }

      // Delay before retry
      await new Promise(res => setTimeout(res, delay));
    }
  }
}