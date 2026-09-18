import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  console.log('Starting database migrations...');
  try {
    const migrationPath = path.resolve(__dirname, '../../../database/migrations/01_init.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(sql);
    console.log('Database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
