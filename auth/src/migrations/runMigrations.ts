import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

export async function runMigrations(pool: mysql.Pool): Promise<void> {
  console.log('Running database migrations...');

  // Create migrations tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get all migration files
  const migrationsDir = path.join(__dirname);
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('_up.sql'))
    .sort(); // Sort to ensure correct order

  // Check which migrations have already been run
  const [executedMigrations] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT filename FROM migrations'
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
        'INSERT INTO migrations (filename) VALUES (?)',
        [file]
      );
      
      console.log(`Migration ${file} completed successfully`);
    } catch (error) {
      console.error(`Error running migration ${file}:`, error);
      throw error;
    }
  }

  console.log('All migrations completed');
}
