import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

export async function runMigrations(pool: mysql.Pool, migrationsDir: string, service: string): Promise<void> {
  console.log(`Running database migrations for the ${service} service...`);

  // Sanitize service name
  const sanitizedService = service.replace(/[^a-zA-Z0-9_]/g, '');
  const migrationsTable = `migrations_${sanitizedService}`;

  // Create migrations tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${migrationsTable} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.log(`No migrations directory found at ${migrationsDir}, skipping migrations...`);
    return;
  }

  // Get all migration files from the provided directory
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('_up.sql'))
    .sort(); // Sort to ensure correct order

  // Check which migrations have already been run
  const [executedMigrations] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT filename FROM ${migrationsTable}`
  );
  const executedFiles = new Set(executedMigrations.map(row => row.filename));

  // Run pending migrations
  for (const file of files) {
    if (executedFiles.has(file)) {
      console.log(`Migration ${file} already executed, skipping...`);
      continue;
    }

    console.log(`Running migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      // Execute the migration
      await pool.query(sql);
      
      // Record that this migration was executed
      await pool.query(
        `INSERT INTO ${migrationsTable} (filename) VALUES (?)`,
        [file]
      );
      
      console.log(`Migration ${file} completed successfully`);
    } catch (error) {
      console.error(`Error running migration ${file}:`, error);
      throw error;
    }
  }

  console.log('All migrations completed for the ' + service + ' service');
}
