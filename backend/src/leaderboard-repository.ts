import { getDb } from './database.js';

export interface ScoreRecord {
  id: number;
  nickname: string;
  score: number;
  createdAt: string;
}

export interface InsertScoreInput {
  nickname: string;
  score: number;
}

export function migrate() {
  const db = getDb();
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.run('CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores (created_at DESC);');
    db.run('CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC);');
  });
}

export function insertScore(input: InsertScoreInput): Promise<number> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(
      'INSERT INTO scores (nickname, score, created_at) VALUES (?, ?, datetime("now"))',
      [input.nickname, input.score],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

export function getTopScores(limit: number): Promise<ScoreRecord[]> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      'SELECT id, nickname, score, created_at as createdAt FROM scores ORDER BY score DESC, created_at ASC LIMIT ?',
      [limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows as ScoreRecord[]);
      }
    );
  });
}

export function getWeeklyTopScores(limit: number): Promise<ScoreRecord[]> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      `SELECT id, nickname, score, created_at as createdAt
       FROM scores
       WHERE created_at >= datetime('now', '-7 days')
       ORDER BY score DESC, created_at ASC
       LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows as ScoreRecord[]);
      }
    );
  });
}

export function getRankForScore(score: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get(
      `SELECT COUNT(*) as rank
       FROM scores
       WHERE score > ?`,
      [score],
      (err, row) => {
        if (err) reject(err);
        else resolve((row as { rank: number }).rank + 1);
      }
    );
  });
}
