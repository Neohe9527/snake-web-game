import sqlite3 from 'sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

let db: sqlite3.Database | null = null;

export function getDb(): sqlite3.Database {
  if (db) return db;
  const dir = path.dirname(config.sqlitePath);
  fs.mkdirSync(dir, { recursive: true });
  db = new sqlite3.Database(config.sqlitePath);
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
